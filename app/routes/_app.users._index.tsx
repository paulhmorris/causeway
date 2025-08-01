import { IconPlus } from "@tabler/icons-react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { UsersTable } from "~/components/users/users-table";
import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const users = await db.user.findMany({
    where: {
      memberships: {
        some: { orgId },
      },
    },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
}

export default function UserIndexPage() {
  const { users } = useLoaderData<typeof loader>();
  return (
    <>
      <title>Users</title>
      <PageHeader title="Users">
        <Button asChild>
          <Link to="/users/new" prefetch="intent">
            <IconPlus className="mr-2 size-5" />
            <span>New User</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        <UsersTable users={users} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
