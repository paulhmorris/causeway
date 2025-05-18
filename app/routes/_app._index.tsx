import { redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";

import { ErrorComponent } from "~/components/error-component";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction = () => [{ title: "Home" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  if (user.isMember) {
    return redirect("/dashboards/staff");
  }
  return redirect("/dashboards/admin");
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
