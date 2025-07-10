import { clerkClient as client } from "~/integrations/clerk.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("AuthService");

export const AuthService = {
  async getInvitationsByEmail(email: string) {
    try {
      const invitations = await client.invitations.getInvitationList({ query: email });
      return invitations.data;
    } catch (error) {
      Sentry.captureException(error, { extra: { email } });
      logger.error({ email, error }, "Error fetching invitation for email");
      throw error;
    }
  },

  async revokeSession(sessionId: string) {
    try {
      const revokedSession = await client.sessions.revokeSession(sessionId);
      logger.info({ sessionId }, "Session revoked successfully");
      return revokedSession;
    } catch (error) {
      Sentry.captureException(error, { extra: { sessionId } });
      logger.error({ sessionId, error }, "Error revoking session");
      throw error;
    }
  },

  linkOAuthUserToExistingUser(username: string, clerkId: string) {
    return db.user.update({
      select: { id: true },
      where: { username },
      data: { clerkId },
    });
  },
};
