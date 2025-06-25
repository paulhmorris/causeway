import { SignUp } from "@clerk/react-router";
import { LoaderFunctionArgs, redirect } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await SessionService.getSession(args);
  if (userId) {
    throw redirect("/");
  }
}

export default function SignUpPage() {
  return (
    <>
      <title>Sign Up</title>
      <SignUp />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
