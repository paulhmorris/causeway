import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("ContactService");

export const ContactService = {
  getTypes(orgId: string) {
    logger.info({ orgId }, "Getting contact types");
    return db.contactType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
