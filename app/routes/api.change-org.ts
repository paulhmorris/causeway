import { Prisma } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, redirect } from "react-router";
import { z } from "zod/v4";

import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { optionalText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  orgId: text,
  pathname: optionalText,
});

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    switch (request.method.toLowerCase()) {
      case "post": {
        const userId = await SessionService.requireUserId(request);
        const result = await parseFormData(request, schema);

        if (result.error) {
          return validationError(result.error);
        }

        const { orgId } = result.data;

        // Ensure the user is a member of the selected organization
        await db.membership.findUniqueOrThrow({ where: { userId_orgId: { userId, orgId } }, select: { id: true } });

        const session = await SessionService.getSession(request);
        session.set(SessionService.ORGANIZATION_SESSION_KEY, orgId);

        const url = new URL(request.url);
        const redirectUrl = new URL("/", url.origin);
        return redirect(redirectUrl.toString(), {
          status: 303,
          headers: {
            "Set-Cookie": await SessionService.commitSession(session),
          },
        });
      }

      default: {
        return new Response("Method Not Allowed", { status: 405, statusText: "Method Not Allowed" });
      }
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return new Response(error.message, { status: 400, statusText: error.message });
    }
    throw new Response("Unknown error", { status: 500, statusText: "Unknown error" });
  }
};
