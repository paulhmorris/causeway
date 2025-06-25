import {} from "@rvf/react-router";
import { IconCoins, IconExclamationCircle, IconUser } from "@tabler/icons-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { AccountTransactionsTable } from "~/components/accounts/account-transactions-table";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { AccountBalanceCard } from "~/components/users/balance-card";
import { db } from "~/integrations/prisma.server";
import { AccountType } from "~/lib/constants";
import { handleLoaderError, unauthorized } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction<typeof loader> = ({ data }) => [{ title: `Account ${data?.account.code}` }];

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  invariant(params.accountId, "accountId not found");

  function canViewAccount() {
    if (user.isSuperAdmin || user.isAdmin) {
      return true;
    }

    if (user.accountId === params.accountId) {
      return true;
    }

    if (user.contact.accountSubscriptions.some((a) => a.accountId === params.accountId)) {
      return true;
    }

    return false;
  }

  if (!canViewAccount()) {
    throw unauthorized("You are not authorized to view this account.");
  }

  try {
    const account = await db.account.findUniqueOrThrow({
      where: { id: params.accountId, orgId },
      select: {
        id: true,
        code: true,
        description: true,
        type: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          include: { contact: true },
        },
        org: true,
        transactions: {
          select: {
            id: true,
            date: true,
            amountInCents: true,
            category: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    const total = await db.transaction.aggregate({
      where: { accountId: account.id },
      _sum: { amountInCents: true },
    });

    return {
      total: total._sum.amountInCents,
      account,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export default function AccountDetailsPage() {
  const { total, account } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title={account.code}>
        <Button variant="outline" asChild>
          <Link to={`/accounts/${account.id}/edit`} prefetch="intent">
            Edit
          </Link>
        </Button>
      </PageHeader>
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-1">
        <Badge variant="outline">
          <div>
            <IconCoins className="size-3" />
          </div>
          <span>{account.type.name}</span>
        </Badge>
        {account.user ? (
          <Link to={`/users/${account.user.id}`} prefetch="intent">
            <Badge variant="secondary">
              <div>
                <IconUser className="size-3" />
              </div>
              {account.user.contact.firstName} {account.user.contact.lastName}
            </Badge>
          </Link>
        ) : account.type.id === AccountType.Ministry ? (
          <Link to={`/accounts/${account.id}/edit`} prefetch="intent">
            <Badge variant="warning">
              <div>
                <IconExclamationCircle className="size-3" />
              </div>
              <span>No linked user</span>
            </Badge>
          </Link>
        ) : null}
      </div>
      <PageContainer>
        <div className="max-w-md">
          <AccountBalanceCard
            totalCents={total}
            title={account.description}
            code={account.type.name}
            accountId={account.id}
          />
        </div>
        <div className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">Transactions</h2>
          <AccountTransactionsTable data={account.transactions} />
        </div>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
