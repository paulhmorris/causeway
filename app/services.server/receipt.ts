import { Prisma } from "@prisma/client";
import dayjs from "dayjs";

import { Bucket } from "~/integrations/bucket.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import {
  OLDER_RECEIPTS_PARAM,
  RECEIPT_CURSOR_PARAM,
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

type GalleryQuery = {
  orgId: string;
  /** Members only see their own receipts; leave undefined for admins. */
  userId?: string;
  includeOlder: boolean;
  search?: string;
  /** Id of the last receipt already loaded, for the next page. */
  cursor?: string;
};

/** Reads the receipt gallery's controls off the request URL. */
export function receiptGalleryOptions(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    includeOlder: params.get(OLDER_RECEIPTS_PARAM) === "true",
    search: params.get(RECEIPT_SEARCH_PARAM) ?? undefined,
    cursor: params.get(RECEIPT_CURSOR_PARAM) ?? undefined,
  };
}

/**
 * The date window is applied on the server rather than in the browser so the payload stays bounded
 * as the receipt table grows. That means older receipts aren't loaded, so every way of reaching
 * them has to be served here too: searching by title, asking for the full history, and paging past
 * the row cap. A search or the full history drops the window; the cap always applies.
 */
function selectableReceiptWhere({ orgId, userId, includeOlder, search }: GalleryQuery): Prisma.ReceiptWhereInput {
  const term = search?.trim();
  const isWindowed = !includeOlder && !term;

  return {
    orgId,
    userId,
    title: term ? { contains: term, mode: "insensitive" } : undefined,
    createdAt: isWindowed ? { gte: dayjs().subtract(RECEIPT_WINDOW_DAYS, "day").toDate() } : undefined,
  };
}

/** Receipts offered for attachment on the income, expense, and reimbursement forms. */
export function getSelectableReceipts(query: GalleryQuery) {
  return db.receipt.findMany({
    where: selectableReceiptWhere(query),
    include: selectableReceiptInclude,
    // createdAt isn't unique, and SQL gives no ordering guarantee between ties, so id makes the
    // sort total. Without it two pages could order the same tied rows differently and skip some.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RECEIPT_SELECTOR_LIMIT,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
}

/** Total matching the same filters, so the gallery can tell the user what it is holding back. */
export function countSelectableReceipts(query: GalleryQuery) {
  return db.receipt.count({ where: selectableReceiptWhere(query) });
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
