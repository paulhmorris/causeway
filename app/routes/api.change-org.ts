import { Prisma } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, redirect } from "react-router";
import { z } from "zod/v4";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { serverError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Api.ChangeOrg");

const schema = z.object({ orgId: text });

export const action = async (args: ActionFunctionArgs) => {
  const { request } = args;
  try {
    switch (request.method.toLowerCase()) {
      case "post": {
        const userId = await SessionService.requireUserId(args);
        const result = await parseFormData(args.request, schema);

        if (result.error) {
          return validationError(result.error);
        }

        const { orgId } = result.data;

        // Ensure the user is a member of the selected organization
        const membership = await db.membership.findUniqueOrThrow({
          where: { userId_orgId: { userId, orgId } },
          select: { id: true, user: { select: { username: true } } },
        });

        const session = await SessionService.getOrgSession(request);
        logger.debug(`Setting session orgId to ${orgId}`);
        session.set(SessionService.ORGANIZATION_SESSION_KEY, orgId);

        const newOrg = await db.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { name: true },
        });

        logger.info(`User ${membership.user.username} changed orgs to ${newOrg.name}.`);
        return redirect("request.url", {
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
  } catch (e) {
    logger.error(e);
    Sentry.captureException(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Toasts.dataWithError(null, {
        message: "Error",
        description: "No membership found for the selected organization",
      });
    }
    throw serverError("An unknown error occurred");
  }
};
