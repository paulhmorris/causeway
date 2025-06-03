import { LoaderFunctionArgs, MetaFunction, NavLink, Outlet, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { Separator } from "~/components/ui/separator";
import { db } from "~/integrations/prisma.server";
import { handleLoaderError } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  try {
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    return { org };
  } catch (e) {
    handleLoaderError(e);
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Settings | ${data?.org.name}` }];
};

const links = [
  { label: "Settings", to: "settings" },
  { label: "Transaction Categories", to: "transaction-categories" },
];

export default function OrganizationSettingsLayout() {
  const { org } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title={`${org.name} Settings`} />
      <nav className="mt-4">
        <ul className="bg-muted text-muted-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md p-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                prefetch="intent"
                className={({ isActive }) =>
                  cn(
                    "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                    isActive ? "bg-background text-foreground shadow-xs" : "hover:bg-background/50",
                  )
                }
                to={link.to}
              >
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Separator className="my-4" />
      <Outlet />
    </>
  );
}
