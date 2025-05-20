import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction , NavLink, Outlet, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { Separator } from "~/components/ui/separator";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  try {
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    return { org };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw handlePrismaError(error);
    }
    throw serverError("Unknown error occurred");
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
        <ul className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-muted p-1 text-muted-foreground">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                prefetch="intent"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    isActive ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50",
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
