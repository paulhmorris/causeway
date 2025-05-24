import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useSearchParams } from "react-router";
import { z } from "zod/v4";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Toasts } from "~/lib/toast.server";
import { safeRedirect } from "~/lib/utils";
import { EmailSchema } from "~/models/schemas";
import { generateVerificationCode, verifyLogin } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  email: EmailSchema,
  password: z.string().min(8, { message: "Password must be 8 or more characters." }),
  redirectTo: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.getUser(request);
  const orgId = await SessionService.getOrgId(request);

  if (user && orgId) {
    return redirect("/");
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await parseFormData(request, schema);

  if (result.error) {
    return validationError(result.error);
  }

  const { email, password, redirectTo } = result.data;
  const user = await verifyLogin({ username: email, password });

  if (!user) {
    return validationError({
      fieldErrors: {
        email: "Email or password is incorrect",
      },
    });
  }

  if (user.lockoutExpiration && user.lockoutExpiration > new Date()) {
    return validationError({
      fieldErrors: {
        email: "Your account is locked. Please try again in 15 minutes.",
      },
    });
  }

  if (user.memberships.length === 0) {
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "You are not a member of any organizations. Please contact your administrator.",
    });
  }

  // Skip verification code step in dev/qa
  if (process.env.VERCEL_ENV !== "production") {
    return SessionService.createUserSession({
      request,
      userId: user.id,
      orgId: user.memberships[0].orgId,
      redirectTo: safeRedirect(redirectTo, "/"),
      remember: false,
    });
  }

  await generateVerificationCode(user.id);
  const url = new URL("/login/verify", request.url);
  url.searchParams.set("email", email);
  url.searchParams.set("redirectTo", redirectTo ?? "/");
  return redirect(url.toString());
};

export const meta: MetaFunction = () => [{ title: "Login" }];

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  return (
    <AuthCard>
      <h1 className="text-3xl font-extrabold">Login</h1>
      <ValidatedForm
        schema={schema}
        method="post"
        className="mt-4 space-y-4"
        defaultValues={{
          email: import.meta.env.DEV ? "paulh.morris@gmail.com" : "",
          password: import.meta.env.DEV ? "password" : "",
        }}
      >
        {(form) => (
          <>
            <FormField label="Email" scope={form.scope("email")} type="email" autoComplete="username" required />
            <FormField
              label="Password"
              scope={form.scope("password")}
              type="password"
              autoComplete="current-password"
              required
            />

            <input type="hidden" name="redirectTo" value={redirectTo} />
            <SubmitButton isSubmitting={form.formState.isSubmitting} className="w-full">
              Log in
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
