import { parseFormData, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import { type ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { email } from "~/schemas/fields";
import { sendPasswordResetEmail, sendPasswordSetupEmail } from "~/services.server/mail";
import { deletePasswordReset, generatePasswordReset, getPasswordResetByUserId } from "~/services.server/password";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ResetPassword");

export const passwordResetSchema = z.object({
  username: email,
  _action: z.enum(["reset", "setup"]),
});

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const orgId = await SessionService.getOrgId(request);

  const result = await parseFormData(args.request, passwordResetSchema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const user = await db.user.findUnique({ where: { username: result.data.username } });
    if (!user) {
      return Toasts.dataWithError(null, {
        message: "User not found",
        description: `There is no user with username ${result.data.username}.`,
      });
    }

    const existingReset = await getPasswordResetByUserId(user.id);
    if (existingReset) {
      return Toasts.dataWithWarning(
        { message: "Existing request found" },
        {
          message: "Existing request found",
          description: `A password reset request has already been sent. It expires in ${dayjs(
            existingReset.expiresAt,
          ).diff(dayjs(), "minutes")} minutes.`,
        },
      );
    }

    const reset = await generatePasswordReset(user.username);
    const { data, error } =
      result.data._action === "setup"
        ? await sendPasswordSetupEmail({ email: user.username, token: reset.token, orgId })
        : await sendPasswordResetEmail({ email: user.username, token: reset.token });

    const isError = Boolean(error) || !data || ("statusCode" in data && data.statusCode !== 200);

    if (isError) {
      // Rollback the password reset
      await deletePasswordReset(reset.token);
      throw error;
    }

    // Success
    return Toasts.dataWithSuccess(
      { data },
      { message: "Email sent", description: "Check the email for a link to set the password." },
    );
  } catch (e) {
    logger.error(e);
    Sentry.captureException(e);
    return Toasts.dataWithError({ error: e }, { message: "Error", description: "An unknown error occurred" });
  }
}
