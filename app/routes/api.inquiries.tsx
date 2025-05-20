import { render } from "@react-email/render";
import { validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { ActionFunctionArgs, data } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";

import { NewInquiryEmail } from "emails/new-inquiry";
import { sendEmail } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export const validator = withZod(
  z.object({
    name: z.string().trim(),
    method: z.string(),
    otherMethod: z.string().optional(),
    email: zfd.text(z.string().email({ message: "Invalid email address" }).optional()),
    phone: zfd.text(
      z
        .string()
        .transform((val) => val.replace(/\D/g, ""))
        .pipe(z.string().length(10, { message: "Invalid phone number" }))
        .optional(),
    ),
    message: z.string().max(1000),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const org = await SessionService.getOrg(request);

  if (!org) {
    throw data({ success: false, message: "Organization not found" }, { status: 400 });
  }

  if (request.method !== "POST") {
    throw data({ success: false, message: "Method Not Allowed" }, { status: 405 });
  }

  const result = await validator.validate(await request.formData());
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
    const html = render(<NewInquiryEmail url={url} username={user.username} {...result.data} />);

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
