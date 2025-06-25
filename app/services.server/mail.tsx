import type { ReimbursementRequestStatus, User } from "@prisma/client";
import { render } from "@react-email/render";

import { ReimbursementRequestUpdateEmail } from "emails/reimbursement-request-update";
import { sendEmail } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";
import { capitalize } from "~/lib/utils";

export async function sendReimbursementRequestUpdateEmail(args: {
  email: User["username"];
  status: ReimbursementRequestStatus;
}) {
  try {
    const url = new URL("/", CONFIG.baseUrl).toString();
    const html = await render(<ReimbursementRequestUpdateEmail status={args.status} url={url} />);

    const data = await sendEmail({
      to: args.email,
      subject: `Reimbursement Request ${capitalize(args.status)}`,
      html,
    });
    return { data };
  } catch (error) {
    Sentry.captureException(error);
    return { error };
  }
}
