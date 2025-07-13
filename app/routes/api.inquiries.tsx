import { render } from "@react-email/render";
import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, data } from "react-router";
import { z } from "zod/v4";

import { NewInquiryEmail } from "emails/new-inquiry";
import { Mailer } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";
import { Toasts } from "~/lib/toast.server";
import { longText, optionalEmail, optionalPhoneNumber, optionalText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Api.Inquiries");

export const schema = z.object({
  name: text,
  method: text,
  otherMethod: optionalText,
  email: optionalEmail,
  phone: optionalPhoneNumber,
  message: longText,
});

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const org = await SessionService.getOrg(args);
  const user = await SessionService.requireUser(args);

  if (!org) {
    throw data({ success: false, message: "Organization not found" }, { status: 400 });
  }

  if (request.method !== "POST") {
    throw data({ success: false, message: "Method Not Allowed" }, { status: 405 });
  }

  const result = await parseFormData(args.request, schema);
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
    const url = new URL("/", CONFIG.baseUrl).toString();
    const html = await render(<NewInquiryEmail url={url} username={user.username} {...result.data} />);

    const { messageId } = await Mailer.send({
      // TODO: remove exclamation after migrations
      to: org.primaryEmail!,
      subject: "New Inquiry",
      html,
    });

    return Toasts.dataWithSuccess(
      { success: true, messageId },
      { message: "Inquiry sent", description: "We'll be in touch soon!" },
    );
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithSuccess(
      { success: false, message: JSON.stringify(error) },
      {
        message: "Error",
        description: "An unknown error occurred",
      },
    );
  }
}
