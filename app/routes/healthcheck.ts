import type { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/prisma.server";

export const loader = async (args: LoaderFunctionArgs) => {
  const host = args.request.headers.get("X-Forwarded-Host") ?? args.request.headers.get("host");

  try {
    const url = new URL("/", `http://${host}`);
    // if we can connect to the database and make a simple query
    // and make a HEAD request to ourselves, then we're good.
    await Promise.all([
      db.user.count(),
      fetch(url.toString(), { method: "HEAD" }).then((r) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        if (!r.ok) return Promise.reject(r);
      }),
    ]);
    return new Response("OK");
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.log("healthcheck ❌", { error });
    return new Response("ERROR", { status: 500 });
  }
};
