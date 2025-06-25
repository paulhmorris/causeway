import { SignIn } from "@clerk/react-router";

import { ErrorComponent } from "~/components/error-component";

export default function LoginPage() {
  return (
    <>
      <title>Login</title>
      <SignIn />
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
