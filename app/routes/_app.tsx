import { useEffect } from "react";
import { data, LoaderFunctionArgs, Outlet, redirect, ShouldRevalidateFunctionArgs, useLoaderData } from "react-router";

import { DesktopNav } from "~/components/desktop-nav";
import { MobileNav } from "~/components/mobile-nav";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/config";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.Root");

export async function loader({ request }: LoaderFunctionArgs) {
  const currentOrg = await SessionService.getOrg(request);
  const userId = await SessionService.getUserId(request);

  // Handle subdomain redirects
  const requestUrl = new URL(request.url);
  const subdomainOfRequest = requestUrl.host.split(".")[0];
  if (currentOrg && subdomainOfRequest !== currentOrg.subdomain) {
    const url = new URL("/", `${import.meta.env.DEV ? "http" : "https"}://${currentOrg.subdomain}.${CONFIG.host}`);
    throw redirect(url.toString());
  }

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
              where: currentOrg
                ? {
                    account: {
                      orgId: currentOrg.id,
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
      logger.error(`No user found for ${userId}`);
      throw await SessionService.logout(request);
    }

    const currentMembership = dbUser.memberships.find((m) => m.orgId === currentOrg?.id);
    if (currentOrg && !currentMembership) {
      logger.warn(`User ${dbUser.username} has no memberships for the current org. Logging out.`);
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
      org: currentOrg ?? null,
    };
  }

  return data({ user });
}

export default function AppLayout() {
  const data = useLoaderData<typeof loader>();

  useEffect(() => {
    if (!data.user) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: data.user.id, username: data.user.username });
  }, [data.user]);

  return (
    <div vaul-drawer-wrapper="" className="bg-background mx-auto flex min-h-dvh w-full flex-col md:flex-row">
      <MobileNav />
      <DesktopNav />
      <main className="w-full max-w-(--breakpoint-2xl) grow p-6 md:ml-64 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}

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
