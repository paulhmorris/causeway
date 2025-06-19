import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { Bucket } from "~/integrations/bucket.server";
import { text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  fileName: text,
  contentType: text,
});

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const userId = await SessionService.requireUserId(args);
  await SessionService.requireOrgId(args);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const result = schema.safeParse(await request.json());
  if (!result.success) {
    const tree = z.treeifyError(result.error);
    return new Response(tree.errors.join(", "), { status: 400 });
  }

  const { fileName, contentType } = result.data;
  const { url, key } = await Bucket.getPUTPresignedUrl({ fileName, contentType, userId });

  return { signedUrl: url, s3Key: key };
}
