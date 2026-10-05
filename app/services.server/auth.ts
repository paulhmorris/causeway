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
      logger.error("Error fetching invitation for email", { email });
      throw error;
    }
  },

  /**
   * Links a Clerk user to the user whose username matches their primary email (`pem` session claim).
   * Users are created in our DB and invited by email, so they have no `clerkId` until first sign-in.
   */
  async linkClerkUser(clerkId: string, primaryEmail: string | undefined) {
    if (!primaryEmail) {
      logger.error("No pem session claim, cannot link Clerk user", { clerkId });
      return null;
    }

    const user = await db.user.findUnique({ where: { username: primaryEmail }, select: { id: true, clerkId: true } });
    if (!user) {
      return null;
    }
    if (user.clerkId) {
      logger.warn("Relinking user to a different Clerk user", { userId: user.id, from: user.clerkId, to: clerkId });
    }

    logger.info("Linking Clerk user", { userId: user.id, clerkId });
    return db.user.update({ where: { id: user.id }, data: { clerkId }, select: { id: true } });
  },
};
