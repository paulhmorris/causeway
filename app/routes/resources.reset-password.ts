import type { ActionFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import dayjs from "dayjs";
import { typedjson } from "remix-typedjson";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { sendPasswordResetEmail, sendPasswordSetupEmail } from "~/services.server/mail";
import { deletePasswordReset, generatePasswordReset, getPasswordResetByUserId } from "~/services.server/password";

export const passwordResetValidator = withZod(
  z.object({
    username: z.string().email(),
    _action: z.enum(["reset", "setup"]),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return typedjson({ status: 405 });
  }

  const result = await passwordResetValidator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const url = new URL(request.url);
  const subdomain = url.hostname.split(".")[0];

  try {
    const org = await db.organization.findUniqueOrThrow({ where: { subdomain }, select: { id: true } });
    const user = await db.user.findUnique({ where: { username: result.data.username } });
    if (!user) {
      return Toasts.jsonWithError(
        { message: "User not found" },
        { title: "User not found", description: `There is no user with username ${result.data.username}.` },
      );
    }

    const existingReset = await getPasswordResetByUserId(user.id);
    if (existingReset) {
      return Toasts.jsonWithWarning(
        { message: "Existing request found" },
        {
          title: "Existing request found",
          description: `A password reset request has already been sent. It expires in ${dayjs(
            existingReset.expiresAt,
          ).diff(dayjs(), "minutes")} minutes.`,
        },
      );
    }

    const reset = await generatePasswordReset(user.username);
    const { data, error } =
      result.data._action === "setup"
        ? await sendPasswordSetupEmail({ email: user.username, token: reset.token, orgId: org.id })
        : await sendPasswordResetEmail({ email: user.username, token: reset.token });

    const isError = Boolean(error) || !data || ("statusCode" in data && data.statusCode !== 200);

    if (isError) {
      // Rollback the password reset
      await deletePasswordReset(reset.token);
      throw error;
    }

    // Success
    return Toasts.jsonWithSuccess(
      { data },
      {
        title: "Email sent",
        description: "Check the email for a link to set the password.",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { error },
      {
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "There was an error sending the password reset email.",
      },
    );
  }
}
