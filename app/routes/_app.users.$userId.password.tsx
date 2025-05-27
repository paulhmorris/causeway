import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { unauthorized } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { password } from "~/schemas/fields";
import { hashPassword, verifyLogin } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

const schema = z
  .object({
    oldPassword: password,
    newPassword: password,
    confirmation: password,
  })
  .check((ctx) => {
    if (ctx.value.newPassword !== ctx.value.confirmation) {
      ctx.issues.push({
        code: "custom",
        message: "Passwords must match",
        input: ctx.value.confirmation,
      });
    }
  });

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

  const result = await parseFormData(request, schema);
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
    return Toasts.dataWithError({ success: false }, { message: "Error", description: "An unknown error occurred" });
  }
}

export default function UserPassword() {
  const user = useUser();
  return (
    <>
      <h2 className="sr-only">Change Password</h2>
      <ValidatedForm
        schema={schema}
        method="post"
        className="mt-4 max-w-md space-y-4"
        resetAfterSubmit
        defaultValues={{
          oldPassword: "",
          newPassword: "",
          confirmation: "",
        }}
      >
        {(form) => (
          <>
            <input type="hidden" name="username" value={user.username} />
            <FormField
              label="Old password"
              scope={form.scope("oldPassword")}
              type="password"
              autoComplete="current-password"
              required
            />
            <FormField
              label="New Password"
              scope={form.scope("newPassword")}
              type="password"
              autoComplete="new-password"
              required
            />
            <FormField
              label="Confirm New Password"
              scope={form.scope("confirmation")}
              type="password"
              autoComplete="new-password"
              required
            />
            <SubmitButton isSubmitting={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
              Save Changes
            </SubmitButton>
          </>
        )}
      </ValidatedForm>
    </>
  );
}
