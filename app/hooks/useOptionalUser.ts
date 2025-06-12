import { useRouteLoaderData } from "react-router";

import { loader as _appLoader } from "~/routes/_app";

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof _appLoader>("routes/_app");
  if (!data) {
    return undefined;
  }
  return data.user;
}
