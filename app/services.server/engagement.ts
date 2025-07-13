import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("EngagementService");

export const EngagementService = {
  getTypes(orgId: string) {
    logger.info({ orgId }, "Getting engagement types for organization");
    return db.engagementType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
