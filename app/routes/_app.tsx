import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/react-router";
import { useEffect } from "react";
import { data, LoaderFunctionArgs, Outlet, redirect, ShouldRevalidateFunctionArgs, useLoaderData } from "react-router";

import { DesktopNav } from "~/components/desktop-nav";
import { MobileNav } from "~/components/mobile-nav";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.AppLayout");

export async function loader(args: LoaderFunctionArgs) {
  const { sessionId } = await SessionService.getSession(args);
  const currentOrg = await SessionService.getOrg(args);
  const userId = await SessionService.requireUserId(args);

  const dbUser = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      contactAssignments: true,
      accountId: true,
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
        select: {
          role: true,
          isDefault: true,
          orgId: true,
          org: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const currentMembership = dbUser.memberships.find((m) => m.orgId === currentOrg?.id);
  if (currentOrg && !currentMembership) {
    logger.warn(`User ${dbUser.username} has no memberships for the current org. Logging out.`);
    throw await SessionService.logout(sessionId);
  }

  const { pathname } = new URL(args.request.url);
  if (!currentMembership && !pathname.includes("/choose-org")) {
    return redirect("/choose-org");
  }

  const user = {
    ...dbUser,
    role: currentMembership?.role,
    systemRole: dbUser.role,
    org: currentOrg ?? null,
  };

  return data({ user });
}

export default function AppLayout() {
  const data = useLoaderData<typeof loader>();

  useEffect(() => {
    Sentry.setUser({ id: data.user.id, username: data.user.username });
  }, [data.user]);

  return (
    <>
      <SignedIn>
        <div vaul-drawer-wrapper="" className="bg-background mx-auto flex min-h-dvh w-full flex-col md:flex-row">
          <MobileNav />
          <DesktopNav />
          <main className="w-full max-w-(--breakpoint-2xl) grow p-6 md:ml-64 md:p-10">
            <Outlet />
          </main>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
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
