import { redirect, type LoaderFunctionArgs } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { SessionService } from "~/services.server/session";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  if (user.isMember) {
    return redirect("/dashboards/staff");
  }
  return redirect("/dashboards/admin");
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
