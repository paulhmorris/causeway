import { Prisma } from "@prisma/client";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("AccountService");

export const AccountService = {
  update(id: string, data: Prisma.AccountUpdateInput) {
    logger.debug("Updating account", { id, data });
    return db.account.update({ where: { id }, data });
  },

  getTypes(orgId: string) {
    logger.debug("Getting account types", { orgId });
    return db.accountType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
