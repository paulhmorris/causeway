import { LoaderFunctionArgs, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { ReceiptsTable } from "~/components/receipts/receipts-table";
import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const receipts = await db.receipt.findMany({
    where: {
      orgId,
      userId: user.isMember ? user.id : undefined,
    },
    select: {
      id: true,
      s3Key: true,
      s3Url: true,
      s3UrlExpiry: true,
      title: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      _count: {
        select: { reimbursementRequests: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { receipts };
}

export default function Attachments() {
  const { receipts } = useLoaderData<typeof loader>();

  return (
    <div>
      <PageHeader title="Attachments" />
      <PageContainer>
        <ReceiptsTable data={receipts} />
      </PageContainer>
    </div>
  );
}
