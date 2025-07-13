import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { generateS3Urls } from "~/services.server/receipt";

const logger = createLogger("ReimbursementRequestService");

export const ReimbursementRequestService = {
  async getById(id: string, orgId: string) {
    logger.info({ id, orgId }, "Fetching reimbursement request by id");
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

  // In case of REOPEN, have to jump through a few hoops to get the related transaction's category to fill in the form
  getRelatedTransaction(requestId: string) {
    logger.info({ requestId }, "Fetching related transaction for reimbursement request");
    return db.transactionItem.findFirst({
      where: { description: `Reimbursement ID: ${requestId}` },
      select: {
        transaction: {
          select: {
            category: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  },
};
