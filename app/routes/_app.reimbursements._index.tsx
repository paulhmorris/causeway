import { LoaderFunctionArgs, MetaFunction, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { ReimbursementRequestsTable } from "~/components/reimbursements/reimbursement-requests-table";
import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction = () => [{ title: "Reimbursement Requests" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

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
      <PageHeader title="Reimbursement Requests" />
      <PageContainer>
        <ReimbursementRequestsTable data={requests} />
      </PageContainer>
    </>
  );
}
