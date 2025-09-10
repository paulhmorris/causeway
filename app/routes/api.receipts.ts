import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Api.Receipts");

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  switch (request.method) {
    case "POST": {
      const schema = z.object({ s3Key: z.string(), title: z.string() });
      const result = schema.safeParse(await request.json());
      if (!result.success) {
        return Responses.badRequest(z.prettifyError(result.error));
      }

      try {
        const receipt = await db.receipt.create({
          data: {
            ...result.data,
            orgId,
            userId: user.id,
          },
        });

        return Responses.created({ id: receipt.id });
      } catch (error) {
        logger.error("Error creating receipt", { error });
        Sentry.captureException(error);
        return Responses.serverError();
      }
    }

    case "DELETE": {
      const schema = z.array(z.object({ id: z.uuid() }));
      const result = schema.safeParse(await request.json());
      if (!result.success) {
        return Responses.badRequest(z.prettifyError(result.error));
      }

      try {
        const receiptsToDelete = await db.receipt.findMany({
          where: {
            id: { in: result.data.map((r) => r.id) },
            orgId,
          },
          select: { id: true, userId: true },
        });

        // Members can only delete their own receipts
        if (user.isMember) {
          const invalidReceipt = receiptsToDelete.find((r) => r.userId !== user.id);
          if (invalidReceipt) {
            return Responses.forbidden();
          }
        }

        const userId = user.isMember ? user.id : undefined;

        const count = await db.receipt.deleteMany({
          where: {
            id: { in: result.data.map((r) => r.id) },
            orgId,
            userId,
          },
        });

        return Responses.ok({ count });
      } catch (error) {
        logger.error("Error deleting receipts", { error });
        Sentry.captureException(error);
        return Responses.serverError();
      }
    }

    default: {
      return Responses.methodNotAllowed();
    }
  }
}
