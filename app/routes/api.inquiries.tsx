import { render } from "@react-email/render";
import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, data } from "react-router";
import { z } from "zod/v4";

import { NewInquiryEmail } from "emails/new-inquiry";
import { sendEmail } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { email, longText, optionalText, phoneNumber, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

export const schema = z.object({
  name: text,
  method: text,
  otherMethod: optionalText,
  email: email.optional(),
  phone: phoneNumber.optional(),
  message: longText,
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const org = await SessionService.getOrg(request);

  if (!org) {
    throw data({ success: false, message: "Organization not found" }, { status: 400 });
  }

  if (request.method !== "POST") {
    throw data({ success: false, message: "Method Not Allowed" }, { status: 405 });
  }

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { method, otherMethod } = result.data;

  if (method === "Other" && (!otherMethod || otherMethod === "")) {
    return validationError({
      fieldErrors: {
        otherMethod: "This field is required",
      },
      ...result.data,
    });
  }

  try {
    const url = new URL("/", `https://${org.subdomain ? org.subdomain + "." : ""}${org.host}`).toString();
    const html = await render(<NewInquiryEmail url={url} username={user.username} {...result.data} />);

    const { messageId } = await sendEmail({
      from: `${org.name} <${org.replyToEmail}@${org.host}>`,
      to: `${org.inquiriesEmail}@${org.host}`,
      subject: "New Inquiry",
      html,
    });

    return Toasts.dataWithSuccess(
      { success: true, messageId },
      { message: "Inquiry sent", description: "We'll be in touch soon!" },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithSuccess(
      { success: false, message: JSON.stringify(error) },
      {
        message: "Error sending email",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      },
    );
  }
}
