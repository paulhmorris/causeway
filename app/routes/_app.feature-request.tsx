import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, MetaFunction } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { longText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.FeatureRequest");

const schema = z.object({
  title: text,
  type: text,
  description: longText,
});

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { type, title, description } = result.data;

  try {
    await sendEmail({
      to: "paul@paulmorris.dev",
      subject: `New ${type}: ${title}`,
      html: `A new ${type} has been submitted by ${user.contact.email}.\n\n${description}`,
    });

    return Toasts.redirectWithSuccess(user.isMember ? "/dashboards/staff" : "/dashboards/admin", {
      message: "Request Sent",
    });
  } catch (e) {
    logger.error(e);
    Sentry.captureException(e);
    return Toasts.dataWithError(null, { message: "Error", description: "An unknown error occurred." });
  }
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
