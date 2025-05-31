import { useRouteLoaderData } from "react-router";

import { loader as rootLoader } from "~/root";

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  if (!data) {
    return undefined;
  }
  return data.user;
}
