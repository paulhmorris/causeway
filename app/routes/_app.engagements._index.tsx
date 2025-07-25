import { IconPlus } from "@tabler/icons-react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { EngagementsTable } from "~/components/contacts/engagements-table";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/prisma.server";
import { handleLoaderError } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  try {
    const user = await SessionService.requireUser(args);
    const orgId = await SessionService.requireOrgId(args);

    const engagements = await db.engagement.findMany({
      where: {
        orgId,
        userId: user.isMember ? user.id : undefined,
      },
      select: {
        id: true,
        date: true,
        type: {
          select: { name: true },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        user: {
          select: {
            contact: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });
    return { engagements };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function EngagementIndexPage() {
  const { engagements } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Engagements</title>
      <PageHeader title="Engagements">
        <Button asChild>
          <Link to="/engagements/new" prefetch="intent">
            <IconPlus className="mr-2 size-5" />
            <span>New Engagement</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        <EngagementsTable data={engagements} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
