import { TransactionItemTypeDirection } from "@prisma/client";
import { z } from "zod/v4";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { TransactionItemSchema } from "~/schemas";

const logger = createLogger("TransactionService");

export const TransactionService = {
  /** Only admins may know who gave an anonymous gift, so the donor never reaches a member's browser. */
  hideAnonymousDonor<T extends { isAnonymous: boolean; contact: object | null; contactId?: string | null }>(
    transaction: T,
    user: { isMember: boolean },
  ): T {
    if (!user.isMember || !transaction.isAnonymous) {
      return transaction;
    }
    return { ...transaction, contact: null, ...("contactId" in transaction ? { contactId: null } : {}) };
  },

  getItemMethods(orgId: string) {
    logger.debug("Fetching transaction item methods", { orgId });
    return db.transactionItemMethod.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },

  getItemTypes(orgId: string) {
    logger.debug("Fetching transaction item types", { orgId });
    return db.transactionItemType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },

  getCategories(orgId: string) {
    logger.debug("Fetching transaction categories", { orgId });
    return db.transactionCategory.findMany({
      select: { id: true, name: true },
      where: { OR: [{ orgId }, { orgId: null }] },
    });
  },

  async generateItems(items: Array<z.infer<typeof TransactionItemSchema>>, orgId: string) {
    const trxItemTypes = await this.getItemTypes(orgId);

    const totalInCents = items.reduce((acc, item) => {
      const type = trxItemTypes.find((t) => t.id === item.typeId);
      if (!type) {
        throw new Error(`Invalid transaction item typeId: ${item.typeId}`);
      }
      const modifier = type.direction === TransactionItemTypeDirection.IN ? 1 : -1;
      return acc + item.amountInCents * modifier;
    }, 0);

    const transactionItems = items.map((item) => {
      const type = trxItemTypes.find((t) => t.id === item.typeId);
      if (!type) {
        throw new Error(`Invalid transaction item typeId: ${item.typeId}`);
      }

      const modifier = type.direction === TransactionItemTypeDirection.IN ? 1 : -1;
      return {
        ...item,
        orgId,
        amountInCents: item.amountInCents * modifier,
      };
    });
    logger.info("Generated transaction items", { orgId, transactionItems, totalInCents });

    return { totalInCents, transactionItems };
  },
};
