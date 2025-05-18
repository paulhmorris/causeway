import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { data, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { unauthorized } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getSearchParam } from "~/lib/utils";
import { hashPassword } from "~/services.server/auth";
import { expirePasswordReset, getPasswordResetByToken } from "~/services.server/password";
import { SessionService, sessionStorage } from "~/services.server/session";

const validator = withZod(
  z
    .object({
      token: z.string(),
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
  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  // Check token
  const { newPassword, token } = result.data;
  const reset = await getPasswordResetByToken(token);
  if (!reset) {
    return Toasts.jsonWithError({ success: false }, { title: "Token not found", description: "Please try again." });
  }

  // Check expiration
  if (reset.expiresAt < new Date()) {
    return Toasts.jsonWithError({ success: false }, { title: "Token expired", description: "Please try again." });
  }

  // Check token against param
  if (token !== tokenParam) {
    return Toasts.jsonWithError({ success: false }, { title: "Invalid token", description: "Please try again." });
  }

  // Check user
  const userFromToken = await db.user.findUnique({
    where: { id: reset.userId },
    include: { contact: true },
  });
  if (!userFromToken) {
    return Toasts.jsonWithError({ success: false }, { title: "User not found", description: "Please try again." });
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
    title: `Password ${isReset ? "reset" : "set up"}`,
    description: `Your password has been ${isReset ? "reset" : "set up"}. Login with your new password.`,
  });
}

export default function NewPassword() {
  const [searchParams] = useSearchParams();
  const isReset = searchParams.get("isReset") === "true";

  return (
    <AuthCard>
      <h1 className="text-3xl font-extrabold">Set a new password.</h1>
      <ValidatedForm id="password-form" validator={validator} method="post" className="mt-4 space-y-4">
        <input type="hidden" name="token" value={searchParams.get("token") ?? ""} />
        <FormField label="New Password" name="newPassword" type="password" autoComplete="new-password" required />
        <FormField
          label="Confirm New Password"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton>{isReset ? "Reset" : "Create"} Password</SubmitButton>
      </ValidatedForm>
    </AuthCard>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
