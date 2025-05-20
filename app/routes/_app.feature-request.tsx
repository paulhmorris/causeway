import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { ActionFunctionArgs, MetaFunction } from "react-router";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { Toasts } from "~/lib/toast.server";
import { constructOrgMailFrom } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z.object({
    title: z.string(),
    description: z.string(),
    type: z.string(),
    attachmentUrl: z.string().url().or(z.literal("")),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { type, title, description } = result.data;

  await sendEmail({
    to: "paul@paulmorris.dev",
    from: constructOrgMailFrom(user.org),
    subject: `New ${type}: ${title}`,
    html: `A new ${type} has been submitted by ${user.contact.email}.\n\n${description}`,
  });

  return Toasts.redirectWithSuccess(user.isMember ? "/dashboards/staff" : "/dashboards/admin", {
    message: "Request Sent",
  });
}

export const meta: MetaFunction = () => [{ title: `Feature Request` }];

export default function FeatureRequestPage() {
  return (
    <>
      <PageHeader title="Feature Request" description="Request an improvement or feature" />
      <PageContainer className="max-w-sm">
        <ValidatedForm validator={validator} method="post" className="grid gap-4">
          <FormField name="title" label="Title" placeholder="I'd like to see..." required />
          <FormSelect name="type" label="Type" placeholder="Select issue type" required>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="improvement">Improvement</SelectItem>
          </FormSelect>
          <FormTextarea
            name="description"
            label="Description"
            placeholder="Please enter everything relevant to your request."
            required
          />
          <SubmitButton type="submit">Submit</SubmitButton>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
