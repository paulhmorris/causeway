import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { db } from "~/integrations/prisma.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  await SessionService.requireUserId(args);
  const orgId = await SessionService.requireOrgId(args);

  switch (request.method) {
    case "DELETE": {
      const schema = z.object({ id: z.cuid() });
      const result = schema.safeParse(await request.json());
      if (!result.success) {
        const tree = z.treeifyError(result.error);
        return new Response(tree.errors.join(", "), { status: 400 });
      }

      const receipt = await db.reimbursementRequest.delete({
        where: {
          orgId,
          id: result.data.id,
        },
      });

      return Toasts.dataWithSuccess(
        { receipt },
        { message: "Reimbursement request deleted", description: "Your request was deleted successfully." },
      );
    }
    default: {
      return new Response("Method not allowed", { status: 405 });
    }
  }
}
