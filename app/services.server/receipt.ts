import { Prisma } from "@prisma/client";

import { Bucket } from "~/integrations/bucket.server";
import { logger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

type ReceiptWithS3Url = Prisma.ReceiptGetPayload<{
  select: { s3Url: true; title: true; s3Key: true; id: true; s3UrlExpiry: true };
}>;
export async function generateS3Urls(receipts: Array<ReceiptWithS3Url>) {
  let updatedReceipts: Array<ReceiptWithS3Url> = receipts;

  if (receipts.some((r) => !r.s3Url || isS3Expired(r))) {
    const updatePromises = receipts.map(async (receipt) => {
      if (!receipt.s3Url || isS3Expired(receipt)) {
        logger.info(`Generating url for ${receipt.title}`);
        const url = await Bucket.getGETPresignedUrl(receipt.s3Key);
        updatedReceipts = receipts.map((r) => (r.id === receipt.id ? { ...r, s3Url: url } : r));
        return db.receipt.update({
          where: { id: receipt.id },
          data: { s3Url: url, s3UrlExpiry: new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000) },
        });
      }
    });

    await Promise.all(updatePromises);
  }
  return updatedReceipts;
}

function isS3Expired(receipt: ReceiptWithS3Url) {
  return !receipt.s3Url || (receipt.s3UrlExpiry && new Date(receipt.s3UrlExpiry).getTime() < new Date().getTime());
}
