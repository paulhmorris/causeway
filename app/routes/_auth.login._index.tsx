import { parseFormData, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { LoginForm, loginSchema } from "~/components/forms/login-form";
import { Toasts } from "~/lib/toast.server";
import { safeRedirect } from "~/lib/utils";
import { generateVerificationCode, verifyLogin } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  const orgId = await SessionService.getOrgId(request);

  if (userId && orgId) {
    return redirect("/");
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await parseFormData(request, loginSchema);

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

export default function LoginPage() {
  return (
    <>
      <title>Login</title>
      <AuthCard>
        <h1 className="text-3xl font-black sm:text-4xl">Login</h1>
        <LoginForm />
      </AuthCard>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
