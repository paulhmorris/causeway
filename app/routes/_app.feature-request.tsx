import { ActionFunctionArgs } from "@remix-run/node";
import { MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { useState } from "react";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { Linear } from "~/integrations/linear.server";
import { Sentry } from "~/integrations/sentry";
import { LinearLabelID, LinearTeamID } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z.object({
    title: z.string(),
    description: z.string(),
    labelId: z.string(),
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

  const { labelId, title, description } = result.data;

  const issueRequest = await Linear.createIssue({
    title,
    teamId: LinearTeamID.Alliance,
    labelIds: [labelId],
    description: `${description}\n\n---\n\n- created by ${user.contact.email}\n\n${
      result.data.attachmentUrl ? `![Attachment](${result.data.attachmentUrl})` : ""
    }`,
  });

  if (!issueRequest.success) {
    console.error("Error creating issue", issueRequest);
    Sentry.captureException(issueRequest);
  }

  await sendEmail({
    to: "paul@paulmorris.dev",
    subject: `New Feature Request: ${title}`,
    html: `A new feature request has been submitted by ${user.contact.email}.\n\n${description}`,
  });

  return Toasts.redirectWithSuccess(user.isMember ? "/dashboards/staff" : "/dashboards/admin", {
    title: "Request Sent",
    description: "An issue has been created on our board.",
  });
}

export const meta: MetaFunction = () => [{ title: `Feature Request` }];

export default function FeatureRequestPage() {
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileError, setFileError] = useState<string>();

  return (
    <>
      <PageHeader title="Feature Request" description="Request an improvement or feature" />
      <PageContainer className="max-w-sm">
        <ValidatedForm validator={validator} method="post" className="grid gap-4">
          <FormField name="title" label="Title" placeholder="I'd like to see..." required />
          <FormSelect name="labelId" label="Type" placeholder="Select issue type" required>
            <SelectItem value={LinearLabelID.Bug}>Bug</SelectItem>
            <SelectItem value={LinearLabelID.Feature}>Feature</SelectItem>
            <SelectItem value={LinearLabelID.Improvement}>Improvement</SelectItem>
          </FormSelect>
          <FormTextarea
            name="description"
            label="Description"
            placeholder="Please enter everything relevant to your request."
            required
          />
          <div className="space-y-1">
            <input type="hidden" name="attachmentUrl" value={fileUrl} />
            <FormField
              label="Attachment"
              name="attachment-uploader"
              type="file"
              className="cursor-pointer hover:bg-muted"
              accept="image/*"
              onChange={async (e) => {
                setFileError(undefined);

                const files = Array.from(e.currentTarget.files || []);
                const file = files[0];

                const formData = new FormData();
                formData.append("file", file);

                const result = await fetch("/resources/issues/upload-file", {
                  method: "POST",
                  body: formData,
                });
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const json = (await result.json()) as { url: string; error?: string };

                if (result.ok) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  setFileUrl(json.url);
                } else {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  setFileError(JSON.stringify(json.error, null, 2));
                }
              }}
            />
            {fileError ? <p className="text-xs font-medium text-destructive">{fileError}</p> : null}
          </div>
          <SubmitButton type="submit">Submit</SubmitButton>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
