import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services.server/session";

export const action = async ({ request }: ActionFunctionArgs) => {
  Sentry.setUser(null);
  return await SessionService.logout(request);
};

export const loader = () => redirect("/");
