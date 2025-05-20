import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { MetaFunction, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { safeRedirect } from "~/lib/utils";
import { CheckboxSchema } from "~/models/schemas";
import { checkVerificationCode } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z.object({
    email: z.string().min(1, { message: "Email is required" }).email(),
    verificationCode: z.string().min(1, { message: "Verification code is required" }),
    remember: CheckboxSchema,
    redirectTo: z.string().optional(),
  }),
);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.getUser(request);
  const orgId = await SessionService.getOrgId(request);

  if (user && orgId) {
    return redirect("/");
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await validator.validate(await request.formData());

  if (result.error) {
    return validationError(result.error);
  }

  const { email, verificationCode, remember, redirectTo } = result.data;
  const user = await checkVerificationCode(email, verificationCode);

  if (!user) {
    return validationError({
      fieldErrors: {
        verificationCode: "Verification code is incorrect or is expired",
      },
    });
  }

  // If the user has a default membership or only one org, we can just log them in to that org
  const defaultMembership = user.memberships.find((m) => m.isDefault);
  if (user.memberships.length === 1 || defaultMembership) {
    return SessionService.createUserSession({
      request,
      userId: user.id,
      orgId: defaultMembership?.orgId ?? user.memberships[0].orgId,
      redirectTo: safeRedirect(redirectTo, "/"),
      remember: !!remember,
    });
  }
  // Users who are in multiple organizations need to choose which one to log in to
  const url = new URL(request.url);
  const redirectUrl = new URL("/choose-org", url.origin);
  if (redirectTo) {
    redirectUrl.searchParams.set("redirectTo", redirectTo);
  }

  // Log the user in but require them to choose an organization
  return SessionService.createUserSession({
    request,
    userId: user.id,
    redirectTo: redirectUrl.toString(),
    remember: !!remember,
  });
};

export const meta: MetaFunction = () => [{ title: "Verification Code" }];

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  return (
    <AuthCard>
      <h1 className="text-3xl font-extrabold">Enter Verification Code</h1>
      <ValidatedForm validator={validator} method="post" className="mt-4 space-y-4">
        <FormField
          label="Email"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={
            process.env.NODE_ENV === "development" ? "paulh.morris@gmail.com" : (searchParams.get("email") ?? "")
          }
          required
        />
        <FormField label="Code" id="code" name="verificationCode" type="text" autoComplete="one-time-code" required />

        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox id="remember" name="remember" aria-label="Remember this device for 7 days" />
            <Label htmlFor="remember" className="cursor-pointer">
              Remember this device for 7 days
            </Label>
          </div>
        </div>
        <SubmitButton className="w-full">Log in</SubmitButton>
      </ValidatedForm>
    </AuthCard>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
