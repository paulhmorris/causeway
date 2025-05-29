import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, MetaFunction } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { Toasts } from "~/lib/toast.server";
import { constructOrgMailFrom } from "~/lib/utils";
import { longText, text, url } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  title: text,
  type: text,
  description: longText,
  attachmentUrl: url.or(z.literal("")),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await parseFormData(request, schema);
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
        <ValidatedForm
          schema={schema}
          method="post"
          className="grid gap-4"
          defaultValues={{
            title: "",
            type: "",
            description: "",
            attachmentUrl: "",
          }}
        >
          {(form) => (
            <>
              <FormField scope={form.scope("title")} label="Title" placeholder="I'd like to see..." required />
              <FormSelect scope={form.scope("type")} label="Type" placeholder="Select issue type" required>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
              </FormSelect>
              <FormTextarea
                scope={form.scope("description")}
                label="Description"
                placeholder="Please enter everything relevant to your request."
                required
              />
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit</SubmitButton>
            </>
          )}
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
