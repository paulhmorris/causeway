import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("EngagementService");

export const EngagementService = {
  getTypes(orgId: string) {
    logger.debug("Getting engagement types for organization", { orgId });
    return db.engagementType.findMany({ where: { OR: [{ orgId }, { orgId: null }] } });
  },
};
