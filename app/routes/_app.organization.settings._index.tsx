import { Prisma } from "@prisma/client";
import { ActionFunctionArgs } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
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
    name: z.string().min(1, "Organization name is required"),
    primaryEmail: z.string().email("Invalid email address").min(1, "Primary email is required"),
    // host: z.string().nonempty("Host is required"),
    // subdomain: z.string().optional(),
    // replyToEmail: z.string().nonempty("Reply-to email is required"),
    // administratorEmail: z.string().optional(),
    // inquiriesEmail: z.string().optional(),
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
    return Toasts.redirectWithSuccess("/organization/settings", { title: "Organization settings updated" });
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
    <PageContainer>
      <ValidatedForm validator={schema} className="space-y-4 sm:max-w-md" method="post">
        <FormField required label="Organization Name" name="name" defaultValue={org.name} />
        <FormField required label="Primary email" name="primaryEmail" defaultValue={org.primaryEmail || ""} />
        <ButtonGroup>
          <SubmitButton>Save</SubmitButton>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </ButtonGroup>
      </ValidatedForm>
    </PageContainer>
  );
}
