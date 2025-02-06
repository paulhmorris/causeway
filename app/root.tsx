import "@fontsource-variable/dm-sans/wght.css";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  ShouldRevalidateFunctionArgs,
  useRouteError,
} from "@remix-run/react";
import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix";
import { Analytics } from "@vercel/analytics/react";
import { useEffect } from "react";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { Notifications } from "~/components/notifications";
import { GlobalLoader } from "~/components/ui/global-loader";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { getToast } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { SessionService, themeSessionResolver } from "~/services.server/session";
import stylesheet from "~/tailwind.css?url";

// prettier-ignore
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet, as: "style" },
];

export const shouldRevalidate = ({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) => {
  // Don't revalidate on searches and pagination
  const currentSearch = currentUrl.searchParams;
  const nextSearch = nextUrl.searchParams;
  if (
    nextSearch.has("page") ||
    nextSearch.has("s") ||
    nextSearch.has("pageSize") ||
    currentSearch.has("page") ||
    currentSearch.has("s") ||
    currentSearch.has("pageSize")
  ) {
    return false;
  }

  return defaultShouldRevalidate;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (process.env.MAINTENANCE_MODE && new URL(request.url).pathname !== "/maintenance") {
    return redirect("/maintenance", { status: 307 });
  }

  const org = await SessionService.getOrg(request);
  const { toast, headers } = await getToast(request);
  const userId = await SessionService.getUserId(request);
  const { getTheme } = await themeSessionResolver(request);

  let user;
  if (userId) {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      include: {
        contactAssignments: true,
        contact: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            typeId: true,
            accountSubscriptions: {
              where: org
                ? {
                    account: {
                      orgId: org.id,
                    },
                  }
                : {},
              select: {
                accountId: true,
              },
            },
          },
        },
        memberships: {
          include: {
            org: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      throw await SessionService.logout(request);
    }

    const currentMembership = dbUser.memberships.find((m) => m.orgId === org?.id);
    if (org && !currentMembership) {
      console.warn("No membership in the current org - logging out...");
      throw await SessionService.logout(request);
    }

    const { pathname } = new URL(request.url);
    if (!currentMembership && !pathname.includes("/choose-org")) {
      return redirect("/choose-org");
    }

    user = {
      ...dbUser,
      role: currentMembership?.role,
      systemRole: dbUser.role,
      org: org ?? null,
    };
  }

  return typedjson(
    {
      user,
      toast,
      theme: getTheme(),
      ENV: {
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
    },
    { headers },
  );
};

function AppWithProviders() {
  const { theme } = useTypedLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/resources/set-theme">
      <App />
    </ThemeProvider>
  );
}

export default withSentry(AppWithProviders);

function App() {
  const data = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();
  const user = data.user;

  // Set the Sentry user context
  useEffect(() => {
    if (!user) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: user.id, username: user.username });
  }, [user]);

  return (
    <html lang="en" className={cn("h-full", theme || "light")}>
      <head>
        <meta charSet="utf-8" />
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1a1a" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Links />
      </head>
      <body className="h-full min-h-full bg-background font-sans">
        <Analytics debug={false} />
        <Outlet />
        <Notifications />
        <GlobalLoader />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  return (
    <html lang="en" className="h-full">
      <head>
        <title>Oh no!</title>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
          <div className="-mb-10">
            <ErrorComponent />
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
