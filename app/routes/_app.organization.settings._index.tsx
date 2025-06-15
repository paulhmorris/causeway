import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, useRouteLoaderData } from "react-router";

import { OrgSettingsForm, orgSettingsSchema } from "~/components/forms/org-settings-form";
import { PageContainer } from "~/components/page-container";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/_app.organization";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.OrganizationSettings");

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, orgSettingsSchema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    await db.organization.update({ where: { id: orgId }, data: result.data });
    return Toasts.redirectWithSuccess("/organization/settings", { message: "Organization settings updated" });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "Error", description: "An unknown error occurred" });
  }
}

export default function OrganizationSettings() {
  const data = useRouteLoaderData<typeof loader>("routes/_app.organization");

  if (!data) {
    throw new Error("No org data found");
  }

  const { org } = data;

  return (
    <>
      <div className="mt-4 grid grid-cols-3 items-center gap-2 text-sm sm:max-w-2xl">
        <dt className="font-semibold capitalize">Full domain</dt>
        <dd className="text-muted-foreground col-span-2">
          {" "}
          {org.subdomain ? `${org.subdomain}.` : ""}
          {org.host}
        </dd>
        <dt className="font-semibold capitalize">Emails sent from</dt>
        <dd className="text-muted-foreground col-span-2">
          {org.name} &lt;{org.replyToEmail}@{org.host}&gt;
        </dd>
        {org.administratorEmail ? (
          <>
            <dt className="font-semibold capitalize">Reimbursement recipient</dt>
            <dd className="text-muted-foreground col-span-2">
              {org.administratorEmail}@{org.host}
            </dd>
          </>
        ) : null}
        {org.inquiriesEmail ? (
          <>
            <dt className="font-semibold capitalize">Inquiries recipient</dt>
            <dd className="text-muted-foreground col-span-2">
              {org.inquiriesEmail}@{org.host}
            </dd>
          </>
        ) : null}
      </div>
      <PageContainer>
        <OrgSettingsForm org={org} />
      </PageContainer>
    </>
  );
}
