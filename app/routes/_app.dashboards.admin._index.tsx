import { ReimbursementRequestStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Link, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useLocalStorage } from "usehooks-ts";
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
import { missingRequiredEmailWhere } from "~/lib/contact-health";
import { handleLoaderError } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    if (user.isMember) {
      return redirect("/dashboards/staff");
    }

    const [accounts, reimbursementRequests, announcement, missingEmailCount] = await db.$transaction([
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
      db.contact.count({ where: { orgId, ...missingRequiredEmailWhere } }),
    ]);

    return { accounts, reimbursementRequests, announcement, missingEmailCount };
  } catch (e) {
    handleLoaderError(e, { userId: user.id, orgId });
  }
}

/** Dismissing hides the banner until the backlog grows past the size it was waved away at. */
const DISMISSED_STORAGE_KEY = "dashboard-missing-email-dismissed-count";

export default function Index() {
  const { accounts, reimbursementRequests, announcement, missingEmailCount } = useLoaderData<typeof loader>();
  const [dismissedAtCount, setDismissedAtCount] = useLocalStorage(DISMISSED_STORAGE_KEY, 0);

  return (
    <>
      <title>Home</title>
      <PageHeader title="Home" />
      <PageContainer className="max-w-4xl">
        {missingEmailCount > dismissedAtCount ? (
          <Callout variant="warning" className="mb-4 flex items-center gap-4">
            <span>
              {missingEmailCount} donor{missingEmailCount === 1 ? " is" : "s are"} missing an email address, so they
              can't be sent a giving receipt.{" "}
              <Link to="/contacts/health" prefetch="intent" className="text-primary font-medium">
                Review in Contact Health
              </Link>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissedAtCount(missingEmailCount)}
              className="shrink-0"
            >
              Dismiss
            </Button>
          </Callout>
        ) : null}
        <div className="mb-4">
          {announcement ? <AnnouncementCard announcement={announcement} /> : <AnnouncementModal intent="create" />}
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

export function ErrorBoundary() {
  return <ErrorComponent />;
}
