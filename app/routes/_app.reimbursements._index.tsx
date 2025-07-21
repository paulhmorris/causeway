import { LoaderFunctionArgs, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { ReimbursementRequestsTable } from "~/components/reimbursements/reimbursement-requests-table";
import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const requests = await db.reimbursementRequest.findMany({
    where: { orgId },
    include: {
      method: true,
      user: {
        include: {
          contact: true,
        },
      },
      account: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { requests };
}

export default function ReimbursementRequestsList() {
  const { requests } = useLoaderData<typeof loader>();
  return (
    <>
      <title>Reimbursement Requests</title>
      <PageHeader title="Reimbursement Requests" />
      <PageContainer>
        <ReimbursementRequestsTable data={requests} />
      </PageContainer>
    </>
  );
}
