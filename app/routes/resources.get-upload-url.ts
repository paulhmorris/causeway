import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { Bucket } from "~/integrations/bucket.server";
import { text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  fileName: text,
  contentType: text,
});

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);
  await SessionService.requireOrgId(request);

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
