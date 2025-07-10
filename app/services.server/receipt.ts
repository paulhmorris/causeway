import { Prisma } from "@prisma/client";

import { Bucket } from "~/integrations/bucket.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("ReceiptService");

type ReceiptWithS3Url = Prisma.ReceiptGetPayload<{
  select: { s3Url: true; title: true; s3Key: true; id: true; s3UrlExpiry: true };
}>;
export async function generateS3Urls(receipts: Array<ReceiptWithS3Url>) {
  logger.info({ count: receipts.length }, "Generating S3 URLs for receipts");
  let updatedReceipts: Array<ReceiptWithS3Url> = receipts;

  if (receipts.some((r) => !r.s3Url || isS3Expired(r))) {
    logger.debug("Some receipts need new URLs");
    const updatePromises = receipts.map(async (receipt) => {
      if (!receipt.s3Url || isS3Expired(receipt)) {
        logger.info({ receiptId: receipt.id, title: receipt.title }, `Generating presigned url for receipt`);
        const url = await Bucket.getGETPresignedUrl(receipt.s3Key);
        updatedReceipts = receipts.map((r) => (r.id === receipt.id ? { ...r, s3Url: url } : r));
        logger.debug({ receiptId: receipt.id }, "Updating receipt in database with new URL");
        return db.receipt.update({
          where: { id: receipt.id },
          data: { s3Url: url, s3UrlExpiry: new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000) },
        });
      }
    });

    await Promise.all(updatePromises);
    logger.info("Finished updating receipt URLs");
  }
  return updatedReceipts;
}

function isS3Expired(receipt: ReceiptWithS3Url) {
  const expired =
    !receipt.s3Url || (receipt.s3UrlExpiry && new Date(receipt.s3UrlExpiry).getTime() < new Date().getTime());
  logger.debug({ receiptId: receipt.id, expired }, "Checked if S3 URL is expired");
  return expired;
}
