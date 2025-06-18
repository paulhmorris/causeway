import { ClerkProvider } from "@clerk/react-router";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";
import { dark } from "@clerk/themes";
import "@fontsource-variable/dm-sans/wght.css";
import { Analytics } from "@vercel/analytics/react";
import React from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  data,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  ShouldRevalidateFunctionArgs,
  useRouteLoaderData,
} from "react-router";
import { PreventFlashOnWrongTheme, Theme, ThemeProvider, useTheme } from "remix-themes";

import { ErrorComponent } from "~/components/error-component";
import { Notifications } from "~/components/notifications";
import { cn } from "~/lib/utils";
import tailwindUrl from "~/tailwind.css?url";

// eslint-disable-next-line import/no-unresolved
import { Route } from "./+types/root";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: tailwindUrl, as: "style" }];

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

export async function loader(args: LoaderFunctionArgs) {
  if (process.env.MAINTENANCE_MODE && new URL(args.request.url).pathname !== "/maintenance") {
    return redirect("/maintenance", { status: 307 });
  }
  // const { getTheme } = await themeSessionResolver(args.request);
  // const { toast, headers } = await Toasts.getToast(args.request);
  // const theme = getTheme();

  return rootAuthLoader(args, () => {
    return data(
      {
        // toast,
        // theme,
        ENV: {
          VERCEL_URL: process.env.VERCEL_URL,
          VERCEL_ENV: process.env.VERCEL_ENV,
        },
      },
      // { headers },
    );
  });
}

export default function App({ loaderData }: Route.ComponentProps) {
  const [theme] = useTheme();
  return (
    <ClerkProvider
      loaderData={loaderData}
      appearance={{ baseTheme: theme === Theme.DARK ? dark : undefined }}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/login"
      telemetry={{ disabled: true }}
      signInFallbackRedirectUrl="/dashboards/staff"
      signUpFallbackRedirectUrl="/dashboards/staff"
    >
      <Outlet />
    </ClerkProvider>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <ThemeProvider specifiedTheme={data?.theme ?? null} themeAction="/resources/set-theme">
      <InnerLayout ssrTheme={Boolean(data?.theme)}>{children}</InnerLayout>
    </ThemeProvider>
  );
}

function InnerLayout({ ssrTheme, children }: { ssrTheme: boolean; children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const [theme] = useTheme();

  return (
    <html lang="en" className={cn("h-full", theme)}>
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
        <PreventFlashOnWrongTheme ssrTheme={Boolean(ssrTheme)} />
        <Links />
      </head>
      <body className="bg-background h-full min-h-full font-sans">
        {import.meta.env.PROD && data ? <Analytics debug={false} /> : null}
        {children}
        <Notifications />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data?.ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
      <div className="-mb-10">
        <ErrorComponent error={error} />
      </div>
    </main>
  );
}
