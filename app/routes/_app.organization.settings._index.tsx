import { Prisma } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/_app.organization";
import { optionalText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  name: text,
  host: text,
  subdomain: optionalText,
  replyToEmail: text,
  administratorEmail: optionalText,
  inquiriesEmail: optionalText,
});

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    await db.organization.update({ where: { id: orgId }, data: result.data });
    return Toasts.redirectWithSuccess("/organization/settings", { message: "Organization settings updated" });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw handlePrismaError(error);
    }
    throw serverError("Unknown error occurred");
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
        <ValidatedForm
          schema={schema}
          defaultValues={{
            ...org,
            subdomain: org.subdomain ?? "",
            administratorEmail: org.administratorEmail ?? "",
            inquiriesEmail: org.inquiriesEmail ?? "",
          }}
          className="space-y-4 sm:max-w-md"
          method="post"
        >
          {(form) => (
            <>
              <FormField required label="Organization Name" scope={form.scope("name")} defaultValue={org.name} />
              <fieldset>
                <legend className="text-primary text-sm font-bold tracking-widest uppercase">Domain</legend>
                <div className="space-y-2">
                  <FormField
                    required
                    label="Host"
                    scope={form.scope("host")}
                    description={`Your company's primary domain, e.g. "outlook.com"`}
                  />
                  <FormField
                    label="Subdomain"
                    scope={form.scope("subdomain")}
                    description={`Optional subdomain your portal is hosted on, e.g. "acme" for "acme.outlook.com"`}
                  />
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-primary text-sm font-bold tracking-widest uppercase">Email</legend>
                <div className="space-y-2">
                  <FormField
                    required
                    label="Reply-to Email"
                    scope={form.scope("replyToEmail")}
                    description="All emails will be sent from this address, e.g. 'no-reply'"
                  />
                  <FormField
                    label="Requests Email"
                    scope={form.scope("administratorEmail")}
                    description="Receives reimbursement request notifications"
                  />
                  <FormField
                    label="Inquiries Email"
                    scope={form.scope("inquiriesEmail")}
                    description="Receives general inquiries"
                  />
                </div>
              </fieldset>
              <ButtonGroup>
                <SubmitButton isSubmitting={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                  Save
                </SubmitButton>
                <Button type="reset" variant="outline">
                  Reset
                </Button>
              </ButtonGroup>
            </>
          )}
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
