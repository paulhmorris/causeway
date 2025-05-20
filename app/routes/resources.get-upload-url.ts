import { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { Bucket } from "~/integrations/bucket.server";
import { SessionService } from "~/services.server/session";

const validator = z.object({
  fileName: z.string(),
  contentType: z.string(),
});

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);
  await SessionService.requireOrgId(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const result = validator.safeParse(await request.json());
  if (!result.success) {
    return new Response(fromZodError(result.error).toString(), { status: 400 });
  }

  const { fileName, contentType } = result.data;
  const { url, key } = await Bucket.getPUTPresignedUrl({ fileName, contentType, userId });

  return { signedUrl: url, s3Key: key };
}
