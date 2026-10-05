import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { db } from "~/integrations/prisma.server";
import { countSelectableReceipts, getSelectableReceipts, receiptGalleryOptions } from "~/services.server/receipt";
import { SessionService } from "~/services.server/session";

/**
 * Pages the attachment gallery. Kept separate from the form loaders so fetching the next page
 * doesn't re-run their contact, account, and category queries too.
 */
export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  // Admins can see all receipts, users can only see their own
  const query = {
    orgId,
    userId: user.isMember ? user.id : undefined,
    ...receiptGalleryOptions(args.request),
  };

  const [receipts, total] = await db.$transaction([getSelectableReceipts(query), countSelectableReceipts(query)]);
  return { receipts, total };
}

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
