import type { Organization, PasswordReset, ReimbursementRequestStatus, User } from "@prisma/client";
import { render } from "@react-email/render";

import { PasswordResetEmail } from "emails/password-reset";
import { ReimbursementRequestUpdateEmail } from "emails/reimbursement-request-update";
import { sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { capitalize } from "~/lib/utils";

import { WelcomeEmail } from "../../emails/welcome";

type OrgId = Organization["id"];

export async function sendPasswordResetEmail(args: { email: User["username"]; token: PasswordReset["token"] }) {
  const url = new URL("/passwords/new", process.env.BASE_URL);
  url.searchParams.set("token", args.token);
  url.searchParams.set("isReset", "true");

  const html = await render(<PasswordResetEmail url={url.toString()} />);

  try {
    const data = await sendEmail({
      to: args.email,
      subject: "Reset Your Password",
      html,
    });
    return { data };
  } catch (error) {
    Sentry.captureException(error);
    return { error };
  }
}

export async function sendPasswordSetupEmail({
  email,
  token,
  orgId,
}: {
  email: User["username"];
  token: PasswordReset["token"];
  orgId: OrgId;
}) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } });
  const user = await db.user.findUniqueOrThrow({
    where: { username: email },
    select: { contact: { select: { firstName: true } } },
  });
  const url = new URL("/passwords/new", process.env.BASE_URL);
  url.searchParams.set("token", token);

  const html = await render(
    <WelcomeEmail userFirstname={user.contact.firstName} orgName={org.name} url={url.toString()} />,
  );

  try {
    const data = await sendEmail({
      to: email,
      subject: "Setup Your Password",
      html,
    });
    return { data };
  } catch (error) {
    Sentry.captureException(error);
    return { error };
  }
}

export async function sendReimbursementRequestUpdateEmail(args: {
  email: User["username"];
  status: ReimbursementRequestStatus;
}) {
  try {
    const url = new URL("/", process.env.BASE_URL).toString();
    const html = await render(<ReimbursementRequestUpdateEmail status={args.status} url={url} />);

    const data = await sendEmail({
      to: args.email,
      subject: `Reimbursement Request ${capitalize(status)}`,
      html,
    });
    return { data };
  } catch (error) {
    Sentry.captureException(error);
    return { error };
  }
}
