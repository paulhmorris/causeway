import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const userId = await SessionService.requireUserId(args);
  const orgId = await SessionService.requireOrgId(args);

  switch (request.method) {
    case "POST": {
      const schema = z.object({ s3Key: z.string(), title: z.string() });
      const result = schema.safeParse(await request.json());
      if (!result.success) {
        const tree = z.treeifyError(result.error);
        return new Response(tree.errors.join(", "), { status: 400 });
      }

      const receipt = await db.receipt.create({
        data: {
          ...result.data,
          orgId,
          userId,
        },
      });

      return { receipt };
    }
    default: {
      return new Response("Method not allowed", { status: 405 });
    }
  }
}
