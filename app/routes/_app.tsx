import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, ShouldRevalidateFunctionArgs } from "@remix-run/react";

import { DesktopNav } from "~/components/desktop-nav";
import { MobileNav } from "~/components/mobile-nav";
import { SessionService } from "~/services.server/session";

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

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireOrgId(request);
  return null;
}

export default function AppLayout() {
  return (
    <div vaul-drawer-wrapper="" className="mx-auto flex min-h-dvh w-full flex-col bg-background md:flex-row">
      <MobileNav />
      <DesktopNav />
      <main className="w-full max-w-screen-2xl grow p-6 md:ml-64 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
