import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("AccountService");

export const AccountService = {
  getTypes(orgId: string) {
    logger.info({ orgId }, "Getting account types");
    return db.accountType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
