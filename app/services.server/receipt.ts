import { Prisma } from "@prisma/client";
import dayjs from "dayjs";

import { Bucket } from "~/integrations/bucket.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import {
  OLDER_RECEIPTS_PARAM,
  RECEIPT_SEARCH_PARAM,
  RECEIPT_SELECTOR_LIMIT,
  RECEIPT_WINDOW_DAYS,
} from "~/lib/constants";

const logger = createLogger("ReceiptService");

export const selectableReceiptInclude = {
  user: { select: { contact: { select: { email: true } } } },
  reimbursementRequests: { select: { id: true } },
  transactions: { select: { id: true } },
} satisfies Prisma.ReceiptInclude;

/** Reads the receipt gallery's controls off the request URL. */
export function receiptGalleryOptions(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    includeOlder: params.get(OLDER_RECEIPTS_PARAM) === "true",
    search: params.get(RECEIPT_SEARCH_PARAM) ?? undefined,
  };
}

/**
 * Receipts offered for attachment on the income, expense, and reimbursement forms.
 *
 * The date window is applied here rather than in the browser so the payload stays bounded as the
 * receipt table grows — the gallery only ever renders what this returns. Because that means older
 * receipts aren't loaded, both escape hatches have to be served here too: searching by title, and
 * asking for the full history. Either one drops the window, and the row cap still bounds the result.
 */
export function getSelectableReceipts({
  orgId,
  userId,
  includeOlder,
  search,
}: {
  orgId: string;
  /** Members only see their own receipts; leave undefined for admins. */
  userId?: string;
  includeOlder: boolean;
  search?: string;
}) {
  const term = search?.trim();
  const isWindowed = !includeOlder && !term;

  return db.receipt.findMany({
    where: {
      orgId,
      userId,
      title: term ? { contains: term, mode: "insensitive" } : undefined,
      createdAt: isWindowed ? { gte: dayjs().subtract(RECEIPT_WINDOW_DAYS, "day").toDate() } : undefined,
    },
    include: selectableReceiptInclude,
    orderBy: { createdAt: "desc" },
    take: RECEIPT_SELECTOR_LIMIT,
  });
}

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
