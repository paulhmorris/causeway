import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useSearchParams } from "react-router";
import { z } from "zod/v4";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { unauthorized } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getSearchParam } from "~/lib/utils";
import { password, text } from "~/schemas/fields";
import { hashPassword } from "~/services.server/auth";
import { expirePasswordReset, getPasswordResetByToken } from "~/services.server/password";
import { SessionService, sessionStorage } from "~/services.server/session";

const schema = z
  .object({
    token: text,
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

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await SessionService.getSession(request);
  const token = getSearchParam("token", request);
  if (!token) {
    throw unauthorized("No token provided");
  }

  const reset = await getPasswordResetByToken(token);
  if (!reset || reset.expiresAt < new Date()) {
    throw unauthorized("Invalid token");
  }

  return data(null, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const tokenParam = getSearchParam("token", request);
  const isReset = getSearchParam("isReset", request) === "true";

  // Validate form
  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  // Check token
  const { newPassword, token } = result.data;
  const reset = await getPasswordResetByToken(token);
  if (!reset) {
    return Toasts.dataWithError(
      { success: false },
      { message: "Invalid or expired token", description: "Please try again." },
    );
  }

  // Check expiration
  if (reset.expiresAt < new Date()) {
    return Toasts.dataWithError(
      { success: false },
      { message: "Invalid or expired token", description: "Please try again." },
    );
  }

  // Check token against param
  if (token !== tokenParam) {
    return Toasts.dataWithError(
      { success: false },
      { message: "Invalid or expired tokenn", description: "Please try again." },
    );
  }

  // Check user
  const userFromToken = await db.user.findUnique({
    where: { id: reset.userId },
    include: { contact: true },
  });
  if (!userFromToken) {
    return Toasts.dataWithError(
      { success: false },
      { message: "Invalid or expired token", description: "Please try again." },
    );
  }

  const hashedPassword = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userFromToken.id },
    data: {
      password: {
        upsert: {
          create: { hash: hashedPassword },
          update: { hash: hashedPassword },
        },
      },
    },
  });

  // Use token
  await expirePasswordReset(token);

  return Toasts.redirectWithSuccess("/login", {
    message: `Password ${isReset ? "reset" : "set up"}`,
    description: `Your password has been ${isReset ? "reset" : "set up"}. Login with your new password.`,
  });
}

export default function NewPassword() {
  const [searchParams] = useSearchParams();
  const isReset = searchParams.get("isReset") === "true";

  return (
    <AuthCard>
      <h1 className="text-3xl font-extrabold">Set a new password.</h1>
      <ValidatedForm
        schema={schema}
        method="post"
        className="mt-4 space-y-4"
        defaultValues={{
          token: searchParams.get("token") ?? "",
          newPassword: "",
          confirmation: "",
        }}
      >
        {(form) => (
          <>
            <input type="hidden" name="token" value={searchParams.get("token") ?? ""} />
            <FormField
              required
              label="New Password"
              scope={form.scope("newPassword")}
              type="password"
              autoComplete="new-password"
            />
            <FormField
              required
              label="Confirm New Password"
              scope={form.scope("confirmation")}
              type="password"
              autoComplete="new-password"
            />
            <SubmitButton isSubmitting={form.formState.isSubmitting}>
              {isReset ? "Reset" : "Create"} Password
            </SubmitButton>
          </>
        )}
      </ValidatedForm>
    </AuthCard>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
