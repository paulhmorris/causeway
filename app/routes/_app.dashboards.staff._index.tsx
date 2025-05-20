import { type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { AnnouncementCard } from "~/components/admin/announcement-card";
import { ReimbursementRequestsList } from "~/components/admin/reimbursement-requests-list";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { AccountBalanceCard } from "~/components/users/balance-card";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction = () => [{ title: "Home" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const [total, reimbursementRequests, announcement, accountSubscriptions] = await Promise.all([
    db.transaction.aggregate({
      where: {
        orgId,
        account: {
          user: { id: user.id },
        },
      },
      _sum: { amountInCents: true },
    }),
    db.reimbursementRequest.findMany({
      where: {
        orgId,
        userId: user.id,
        status: "PENDING",
      },
      include: {
        account: true,
        user: {
          include: { contact: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.announcement.findFirst({
      where: {
        orgId,
        OR: [
          {
            expiresAt: { gt: dayjs().utc().toDate() },
          },
          { expiresAt: null },
        ],
      },
      orderBy: {
        id: "desc",
      },
    }),
    db.account.findMany({
      where: { orgId, id: { in: user.contact.accountSubscriptions.map((s) => s.accountId) } },
      include: {
        transactions: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);

  return { total: total._sum.amountInCents, reimbursementRequests, announcement, accountSubscriptions };
}

export default function Index() {
  const user = useUser();
  const { total, reimbursementRequests, announcement, accountSubscriptions } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Home" />
      <PageContainer className="max-w-4xl">
        <div className="mb-4">{announcement ? <AnnouncementCard announcement={announcement} /> : null}</div>
        {user.isMember ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2">
            {user.accountId ? (
              <div className="h-full">
                <AccountBalanceCard totalCents={total} accountId={user.accountId} />
              </div>
            ) : null}
            {accountSubscriptions.map((a) => {
              const total = a.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
              return (
                <div key={a.id} className="h-full">
                  <AccountBalanceCard title={a.description} totalCents={total} code={a.code} accountId={a.id} />
                </div>
              );
            })}
            {reimbursementRequests.length > 0 ? (
              <div className="max-w-2xl">
                <ReimbursementRequestsList requests={reimbursementRequests} />
              </div>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
