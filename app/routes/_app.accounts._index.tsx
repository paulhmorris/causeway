import { Prisma } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";

import { AccountsTable } from "~/components/accounts/accounts-table";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/prisma.server";
import { handleLoaderError } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction = () => [{ title: "Accounts" }];

export const accountsIndexSelect: Prisma.AccountSelect = {
  id: true,
  code: true,
  description: true,
  transactions: {
    select: {
      amountInCents: true,
    },
  },
  type: {
    select: {
      name: true,
    },
  },
};
export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const accounts = await db.account.findMany({
      where: { orgId },
      select: accountsIndexSelect,
      orderBy: { code: "asc" },
    });

    const accountsWithBalance = accounts.map((account) => {
      const balance = account.transactions.reduce((acc, transaction) => acc + transaction.amountInCents, 0);
      return { ...account, balance };
    });

    return { accounts: accountsWithBalance };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function AccountsIndexPage() {
  const { accounts } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHeader title="Accounts">
        <Button asChild>
          <Link to="/accounts/new" prefetch="intent">
            <IconPlus className="mr-2 size-5" />
            <span>New Account</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        <AccountsTable data={accounts} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
