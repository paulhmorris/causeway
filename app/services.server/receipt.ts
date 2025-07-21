import { Prisma } from "@prisma/client";

import { Bucket } from "~/integrations/bucket.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("ReceiptService");

type ReceiptWithS3Url = Prisma.ReceiptGetPayload<{
  select: { s3Url: true; title: true; s3Key: true; id: true; s3UrlExpiry: true };
}>;
export async function generateS3Urls(receipts: Array<ReceiptWithS3Url>) {
  logger.info("Generating S3 URLs for receipts...", { count: receipts.length });
  let updatedCount = 0;

  // Use Promise.all to process all receipts and create a new, updated array.
  const updatedReceipts = await Promise.all(
    receipts.map(async (receipt) => {
      if (receipt.s3Url && !isS3Expired(receipt)) {
        return receipt;
      }
      updatedCount++;

      logger.info("Generating presigned url for receipt", { receiptId: receipt.id, title: receipt.title });
      const newUrl = await Bucket.getGETPresignedUrl(receipt.s3Key);
      const newExpiry = new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000); // 6.5 days

      logger.debug("Updating receipt in database with new URL", { receiptId: receipt.id });
      await db.receipt.update({
        where: { id: receipt.id },
        data: { s3Url: newUrl, s3UrlExpiry: newExpiry },
      });

      return {
        ...receipt,
        s3Url: newUrl,
        s3UrlExpiry: newExpiry,
      };
    }),
  );

  logger.debug(`Finished generating S3 URLs for ${updatedCount} receipts.`);
  return updatedReceipts;
}

function isS3Expired(receipt: ReceiptWithS3Url) {
  const expired =
    !receipt.s3Url || (receipt.s3UrlExpiry && new Date(receipt.s3UrlExpiry).getTime() < new Date().getTime());
  return expired;
}
