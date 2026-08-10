import { ReimbursementRequestStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useState } from "react";
import { Link, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router";
dayjs.extend(utc);

import { AnnouncementCard } from "~/components/admin/announcement-card";
import { ReimbursementRequestsList } from "~/components/admin/reimbursement-requests-list";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { AnnouncementModal } from "~/components/modals/announcement-modal";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { AccountBalanceCard } from "~/components/users/balance-card";
import { db } from "~/integrations/prisma.server";
import { AccountType } from "~/lib/constants";
import { sumTotals } from "~/lib/financial-summary";
import { handleLoaderError } from "~/lib/responses.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  try {
    const user = await SessionService.requireUser(args);
    const orgId = await SessionService.requireOrgId(args);

    if (user.isMember) {
      return redirect("/dashboards/staff");
    }

    const [accounts, reimbursementRequests, announcement, missingEmailCount, ytdTransactions] = await db.$transaction([
      db.account.findMany({
        select: {
          id: true,
          code: true,
          description: true,
          transactions: {
            where: { voidedAt: null },
            select: { amountInCents: true },
          },
        },
        where: {
          orgId,
          typeId: AccountType.Operating,
          isHidden: false,
        },
        orderBy: { code: "asc" },
      }),

      db.reimbursementRequest.findMany({
        where: { orgId, status: ReimbursementRequestStatus.PENDING },
        select: {
          id: true,
          amountInCents: true,
          createdAt: true,
          account: {
            select: {
              id: true,
              code: true,
              description: true,
            },
          },
          user: {
            include: { contact: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.announcement.findFirst({
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
        },
        where: {
          orgId,
          OR: [
            {
              expiresAt: { gt: dayjs().utc().toDate() },
            },
            { expiresAt: null },
          ],
        },
        orderBy: { id: "desc" },
      }),
      db.contact.count({ where: { orgId, email: null } }),
      // Year-to-date activity for the headline income/expense/net tiles.
      db.transaction.findMany({
        where: { orgId, voidedAt: null, date: { gte: dayjs().utc().startOf("year").toDate() } },
        select: { amountInCents: true },
      }),
    ]);

    const ytd = sumTotals(ytdTransactions.map((t) => t.amountInCents));
    const pendingTotalInCents = reimbursementRequests.reduce((sum, r) => sum + r.amountInCents, 0);

    return { accounts, reimbursementRequests, announcement, missingEmailCount, ytd, pendingTotalInCents };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function Index() {
  const { accounts, reimbursementRequests, announcement, missingEmailCount, ytd, pendingTotalInCents } =
    useLoaderData<typeof loader>();
  const [healthDismissed, setHealthDismissed] = useState(false);

  const currentYear = dayjs().year();

  return (
    <>
      <title>Home</title>
      <PageHeader title="Home" />
      <PageContainer className="max-w-4xl">
        {missingEmailCount > 0 && !healthDismissed ? (
          <Callout variant="warning" className="mb-4 flex items-center justify-between gap-4">
            <span>
              {missingEmailCount} contact{missingEmailCount === 1 ? " is" : "s are"} missing an email address.{" "}
              <Button variant="link" className="h-auto p-0 font-medium" asChild>
                <Link to="/contacts/health" prefetch="intent">
                  Review in Contact Health
                </Link>
              </Button>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHealthDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0"
            >
              Dismiss
            </Button>
          </Callout>
        ) : null}
        <div className="mb-4">
          {announcement ? <AnnouncementCard announcement={announcement} /> : <AnnouncementModal intent="create" />}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`Income (${currentYear})`} value={formatCentsAsDollars(ytd.incomeInCents)} tone="good" />
          <Stat label={`Expenses (${currentYear})`} value={formatCentsAsDollars(ytd.expenseInCents)} />
          <Stat
            label={`Net (${currentYear})`}
            value={formatCentsAsDollars(ytd.netInCents)}
            tone={ytd.netInCents >= 0 ? "good" : "warning"}
          />
          <Stat
            label="Pending reimbursements"
            value={formatCentsAsDollars(pendingTotalInCents)}
            sublabel={`${reimbursementRequests.length} request${reimbursementRequests.length === 1 ? "" : "s"}`}
            tone={reimbursementRequests.length > 0 ? "warning" : undefined}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/reports/financial" prefetch="intent">
              Financial summary
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/reconciliations" prefetch="intent">
              Reconcile
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/transactions/import" prefetch="intent">
              Import donations
            </Link>
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2">
            {accounts.map((a) => {
              const total = a.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
              return (
                <div key={a.id} className="h-full">
                  <AccountBalanceCard title={a.description} totalCents={total} code={a.code} accountId={a.id} />
                </div>
              );
            })}
          </div>
          {reimbursementRequests.length > 0 ? <ReimbursementRequestsList requests={reimbursementRequests} /> : null}
        </div>
      </PageContainer>
    </>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "good" | "warning";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {sublabel ? <p className="text-muted-foreground text-xs">{sublabel}</p> : null}
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
