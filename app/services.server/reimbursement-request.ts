import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { generateS3Urls } from "~/services.server/receipt";

const logger = createLogger("ReimbursementRequestService");

export const ReimbursementRequestService = {
  async getById(id: string, orgId: string) {
    logger.debug("Fetching reimbursement request by id", { id, orgId });
    const rr = await db.reimbursementRequest.findUnique({
      where: { id, orgId },
      select: {
        id: true,
        date: true,
        status: true,
        vendor: true,
        description: true,
        amountInCents: true,
        approverNote: true,
        user: {
          select: {
            username: true,
            contact: {
              select: {
                email: true,
              },
            },
          },
        },
        account: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
        receipts: {
          select: {
            id: true,
            s3Key: true,
            s3Url: true,
            s3UrlExpiry: true,
            title: true,
          },
        },
        method: {
          select: {
            name: true,
          },
        },
      },
    });

    if (rr) {
      rr.receipts = await generateS3Urls(rr.receipts);
    }

    return rr;
  },

  getLinkedTransaction(requestId: string) {
    logger.debug("Fetching linked transaction for reimbursement request", { requestId });
    return db.transaction.findUnique({
      where: { reimbursementId: requestId },
      select: {
        id: true,
        categoryId: true,
      },
    });
  },
};
