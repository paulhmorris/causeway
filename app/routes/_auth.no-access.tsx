import { SignOutButton } from "@clerk/react-router";

import { AuthCard } from "~/components/auth/auth-card";
import { Button } from "~/components/ui/button";

/** Deliberately loader-less: any auth check here could redirect back and loop. */
export default function NoAccessPage() {
  return (
    <>
      <title>No Access</title>
      <AuthCard>
        <h1 className="text-4xl font-extrabold">No access</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your account isn't linked to any organization. Ask your administrator for an invitation, or sign in with a
          different account.
        </p>
        <SignOutButton redirectUrl="/">
          <Button className="mt-6 w-full">Sign out</Button>
        </SignOutButton>
      </AuthCard>
    </>
  );
}
