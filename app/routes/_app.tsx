import { useEffect } from "react";
import { data, LoaderFunctionArgs, Outlet, ShouldRevalidateFunctionArgs, useLoaderData } from "react-router";

import { DesktopNav } from "~/components/desktop-nav";
import { MobileNav } from "~/components/mobile-nav";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const contactAssignments = await db.contactAssigment.findMany({ where: { userId: user.id } });

  return data({
    user: {
      id: user.id,
      username: user.username,
      accountId: user.accountId,
      contact: user.contact,
      contactAssignments,
      memberships: user.memberships.map(({ role, isDefault, orgId, org }) => ({
        role,
        isDefault,
        orgId,
        org: { name: org.name },
      })),
      role: user.role,
      systemRole: user.systemRole,
      org: { id: user.org.id, name: user.org.name, primaryEmail: user.org.primaryEmail },
    },
  });
}

export default function AppLayout() {
  const data = useLoaderData<typeof loader>();

  useEffect(() => {
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
