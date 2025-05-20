import { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { db } from "~/integrations/prisma.server";
import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireUserId(request);
  const orgId = await SessionService.requireOrgId(request);

  switch (request.method) {
    case "DELETE": {
      const validator = z.object({ id: z.string().cuid() });
      const result = validator.safeParse(await request.json());
      if (!result.success) {
        return badRequest(fromZodError(result.error).toString());
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
