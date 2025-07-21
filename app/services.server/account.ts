import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("AccountService");

export const AccountService = {
  getTypes(orgId: string) {
    logger.debug("Getting account types", { orgId });
    return db.accountType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
