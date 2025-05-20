import { Prisma } from "@prisma/client";
import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { ActionFunctionArgs, useRouteLoaderData } from "react-router";
import { z } from "zod";
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
import { SessionService } from "~/services.server/session";

const schema = withZod(
  z.object({
    name: z.string().nonempty("Organization name is required"),
    host: z.string().nonempty("Host is required"),
    subdomain: z.string().optional(),
    replyToEmail: z.string().nonempty("Reply-to email is required"),
    administratorEmail: z.string().optional(),
    inquiriesEmail: z.string().optional(),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await schema.validate(await request.formData());
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
        <dd className="col-span-2 text-muted-foreground">
          {" "}
          {org.subdomain ? `${org.subdomain}.` : ""}
          {org.host}
        </dd>
        <dt className="font-semibold capitalize">Emails sent from</dt>
        <dd className="col-span-2 text-muted-foreground">
          {org.name} &lt;{org.replyToEmail}@{org.host}&gt;
        </dd>
        {org.administratorEmail ? (
          <>
            <dt className="font-semibold capitalize">Reimbursement recipient</dt>
            <dd className="col-span-2 text-muted-foreground">
              {org.administratorEmail}@{org.host}
            </dd>
          </>
        ) : null}
        {org.inquiriesEmail ? (
          <>
            <dt className="font-semibold capitalize">Inquiries recipient</dt>
            <dd className="col-span-2 text-muted-foreground">
              {org.inquiriesEmail}@{org.host}
            </dd>
          </>
        ) : null}
      </div>
      <PageContainer>
        <ValidatedForm validator={schema} className="space-y-4 sm:max-w-md" method="post">
          <FormField required label="Organization Name" name="name" defaultValue={org.name} />
          <fieldset>
            <legend className="text-sm font-bold uppercase tracking-widest text-primary">Domain</legend>
            <div className="space-y-2">
              <FormField
                required
                label="Host"
                name="host"
                defaultValue={org.host}
                description={`Your company's primary domain, e.g. "outlook.com"`}
              />
              <FormField
                label="Subdomain"
                name="subdomain"
                defaultValue={org.subdomain ?? ""}
                description={`Optional subdomain your portal is hosted on, e.g. "acme" for "acme.outlook.com"`}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold uppercase tracking-widest text-primary">Email</legend>
            <div className="space-y-2">
              <FormField
                required
                label="Reply-to Email"
                name="replyToEmail"
                defaultValue={org.replyToEmail}
                description="All emails will be sent from this address, e.g. 'no-reply'"
              />
              <FormField
                label="Requests Email"
                name="administratorEmail"
                defaultValue={org.administratorEmail ?? ""}
                description="Receives reimbursement request notifications"
              />
              <FormField
                label="Inquiries Email"
                name="inquiriesEmail"
                defaultValue={org.inquiriesEmail ?? ""}
                description="Receives general inquiries"
              />
            </div>
          </fieldset>
          <ButtonGroup>
            <SubmitButton>Save</SubmitButton>
            <Button type="reset" variant="outline">
              Reset
            </Button>
          </ButtonGroup>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
