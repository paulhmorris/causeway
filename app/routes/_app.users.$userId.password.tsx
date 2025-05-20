import { Prisma } from "@prisma/client";
import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { getPrismaErrorText, unauthorized } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { hashPassword, verifyLogin } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z
    .object({
      oldPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmation: z.string().min(8, "Password must be at least 8 characters"),
    })
    .superRefine(({ newPassword, confirmation }, ctx) => {
      if (newPassword !== confirmation) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords must match",
          path: ["confirmation"],
        });
      }
    }),
);

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await SessionService.requireUserId(request);
  invariant(params.userId, "userId not found");

  if (userId !== params.userId) {
    throw unauthorized("You do not have permission to view this page");
  }

  return null;
};

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  invariant(params.userId, "userId not found");

  if (user.id !== params.userId) {
    throw unauthorized("You do not have permission to change this user's password");
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const { oldPassword, newPassword } = result.data;
    const hashedPassword = await hashPassword(newPassword);

    const validUser = await verifyLogin({ username: user.username, password: oldPassword });
    if (!validUser) {
      return validationError({
        fieldErrors: {
          oldPassword: "Incorrect password",
        },
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        password: {
          upsert: {
            create: { hash: hashedPassword },
            update: { hash: hashedPassword },
          },
        },
      },
    });

    return Toasts.redirectWithSuccess(`/users/${params.userId}/password`, { message: "Password updated!" });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    let message = error instanceof Error ? error.message : "An error occurred. Please try again.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      message = getPrismaErrorText(error);
    }
    return Toasts.dataWithError({ success: false }, { message: "An error occurred", description: message });
  }
}

export default function UserPassword() {
  const user = useUser();
  return (
    <>
      <h2 className="sr-only">Change Password</h2>
      <ValidatedForm
        id="password-form"
        validator={validator}
        method="post"
        className="mt-4 max-w-md space-y-4"
        resetAfterSubmit
      >
        <input type="hidden" name="username" value={user.username} />
        <FormField label="Old password" name="oldPassword" type="password" autoComplete="current-password" required />
        <FormField label="New Password" name="newPassword" type="password" autoComplete="new-password" required />
        <FormField
          label="Confirm New Password"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton>Save Changes</SubmitButton>
      </ValidatedForm>
    </>
  );
}
