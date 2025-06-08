import { ValidatedForm } from "@rvf/react-router";
import { useSearchParams } from "react-router";
import { z } from "zod/v4";

import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { email, optionalText, password } from "~/schemas/fields";

export const loginSchema = z.object({
  email: email,
  password: password,
  redirectTo: optionalText,
});

export function LoginForm() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  return (
    <ValidatedForm
      schema={loginSchema}
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
            Login
          </SubmitButton>
        </>
      )}
    </ValidatedForm>
  );
}
