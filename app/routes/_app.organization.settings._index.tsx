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

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, orgSettingsSchema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    await db.organization.update({ where: { id: orgId }, data: result.data });
    return Toasts.redirectWithSuccess("/organization/settings", { message: "Organization settings updated" });
  } catch (error) {
    logger.error("Error updating organization settings", { error });
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
    <PageContainer>
      <OrgSettingsForm org={org} />
    </PageContainer>
  );
}
