import type { Organization, PasswordReset, ReimbursementRequestStatus, User } from "@prisma/client";
import { render } from "@react-email/render";

import { PasswordResetEmail } from "emails/password-reset";
import { ReimbursementRequestUpdateEmail } from "emails/reimbursement-request-update";
import { sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { capitalize, constructOrgMailFrom, constructOrgURL } from "~/lib/utils";

import { WelcomeEmail } from "../../emails/welcome";

type OrgId = Organization["id"];

export async function sendPasswordResetEmail({
  email,
  token,
  orgId,
}: {
  email: User["username"];
  token: PasswordReset["token"];
  orgId: OrgId;
}) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const url = constructOrgURL("/passwords/new", org);
  url.searchParams.set("token", token);
  url.searchParams.set("isReset", "true");

  const html = await render(<PasswordResetEmail url={url.toString()} />);

  try {
    const data = await sendEmail({
      from: constructOrgMailFrom(org),
      to: email,
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
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const user = await db.user.findUniqueOrThrow({
    where: { username: email },
    select: { contact: { select: { firstName: true } } },
  });
  const url = constructOrgURL("/passwords/new", org);
  url.searchParams.set("token", token);

  const html = await render(
    <WelcomeEmail userFirstname={user.contact.firstName} orgName={org.name} url={url.toString()} />,
  );

  try {
    const data = await sendEmail({
      from: constructOrgMailFrom(org),
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

export async function sendReimbursementRequestUpdateEmail({
  email,
  status,
  orgId,
}: {
  email: User["username"];
  status: ReimbursementRequestStatus;
  orgId: OrgId;
  note?: string;
}) {
  try {
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    const url = constructOrgURL("/", org).toString();
    const html = await render(<ReimbursementRequestUpdateEmail status={status} url={url} />);

    const data = await sendEmail({
      from: constructOrgMailFrom(org),
      to: email,
      subject: `Reimbursement Request ${capitalize(status)}`,
      html,
    });
    return { data };
  } catch (error) {
    Sentry.captureException(error);
    return { error };
  }
}
