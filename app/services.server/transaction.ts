import { Organization, TransactionItemTypeDirection } from "@prisma/client";
import { z } from "zod/v4";

import { db } from "~/integrations/prisma.server";
import { TransactionItemSchema } from "~/schemas/schemas";

type OrgId = Organization["id"];

export function getTransactionItemMethods(orgId: OrgId) {
  return db.transactionItemMethod.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
}

export function getTransactionItemTypes(orgId: OrgId) {
  return db.transactionItemType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
}

export async function generateTransactionItems(items: Array<z.infer<typeof TransactionItemSchema>>, orgId: OrgId) {
  const trxItemTypes = await getTransactionItemTypes(orgId);

  // Calculate the total transaction amount
  const totalInCents = items.reduce((acc, i) => {
    const type = trxItemTypes.find((t) => t.id === i.typeId);
    if (!type) {
      throw new Error(`Invalid transaction item typeId: ${i.typeId}`);
    }
    const modifier = type.direction === TransactionItemTypeDirection.IN ? 1 : -1;
    return acc + i.amountInCents * modifier;
  }, 0);

  // Create the transaction items
  const transactionItems = items.map((i) => {
    const type = trxItemTypes.find((t) => t.id === i.typeId);
    if (!type) {
      throw new Error(`Invalid transaction item typeId: ${i.typeId}`);
    }

    const modifier = type.direction === TransactionItemTypeDirection.IN ? 1 : -1;
    return {
      ...i,
      orgId,
      amountInCents: i.amountInCents * modifier,
    };
  });

  return { totalInCents, transactionItems };
}
