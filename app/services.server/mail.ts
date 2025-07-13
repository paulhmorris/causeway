import type { ReimbursementRequestStatus, User } from "@prisma/client";

import { getReimbursementRequestUpdateEmailHtml } from "~/components/emails";
import { Mailer } from "~/integrations/email.server";
import { CONFIG } from "~/lib/env.server";
import { capitalize } from "~/lib/utils";

export async function sendReimbursementRequestUpdateEmail(args: {
  email: User["username"];
  status: ReimbursementRequestStatus;
}) {
  const url = new URL("/", CONFIG.baseUrl).toString();
  const html = await getReimbursementRequestUpdateEmailHtml({ status: args.status, url });

  return Mailer.send({
    to: args.email,
    subject: `Reimbursement Request ${capitalize(args.status)}`,
    html,
  });
}
