import { clerkClient as client } from "~/integrations/clerk.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("AuthService");

export const AuthService = {
  async revokeSession(sessionId: string) {
    try {
      const revokedSession = await client.sessions.revokeSession(sessionId);
      logger.info(`Session ${sessionId} revoked successfully`);
      return revokedSession;
    } catch (error) {
      Sentry.captureException(error, { extra: { sessionId } });
      logger.error(`Error revoking session ${sessionId}:`, error);
      throw error;
    }
  },
};
