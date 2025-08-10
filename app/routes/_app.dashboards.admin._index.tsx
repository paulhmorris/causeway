import { ReimbursementRequestStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { redirect, useLoaderData, type LoaderFunctionArgs } from "react-router";
dayjs.extend(utc);

import { AnnouncementCard } from "~/components/admin/announcement-card";
import { ReimbursementRequestsList } from "~/components/admin/reimbursement-requests-list";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { AnnouncementModal } from "~/components/modals/announcement-modal";
import { PageContainer } from "~/components/page-container";
import { AccountBalanceCard } from "~/components/users/balance-card";
import { db } from "~/integrations/prisma.server";
import { AccountType } from "~/lib/constants";
import { handleLoaderError } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  try {
    const user = await SessionService.requireUser(args);
    const orgId = await SessionService.requireOrgId(args);

    if (user.isMember) {
      return redirect("/dashboards/staff");
    }

    const [accounts, reimbursementRequests, announcement] = await db.$transaction([
      db.account.findMany({
        select: {
          id: true,
          code: true,
          description: true,
          transactions: {
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
    ]);

    return { accounts, reimbursementRequests, announcement };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function Index() {
  const { accounts, reimbursementRequests, announcement } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Home</title>
      <PageHeader title="Home" />
      <PageContainer className="max-w-4xl">
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
