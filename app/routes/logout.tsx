import { useClerk } from "@clerk/react-router";
import { useEffect } from "react";

import { Sentry } from "~/integrations/sentry";

export default function Logout() {
  const { signOut } = useClerk();

  useEffect(() => {
    Sentry.setUser(null);
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  return null;
}
