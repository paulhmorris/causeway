import { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { db } from "~/integrations/prisma.server";
import { SessionService } from "~/services.server/session";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);
  const orgId = await SessionService.requireOrgId(request);

  switch (request.method) {
    case "POST": {
      const validator = z.object({ s3Key: z.string(), title: z.string() });
      const result = validator.safeParse(await request.json());
      if (!result.success) {
        return new Response(fromZodError(result.error).toString(), { status: 400 });
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
