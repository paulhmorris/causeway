import { createClerkClient } from "@clerk/backend";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
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

type ClerkAPIError = {
  code: string;
  message: string;
  longMessage: string;
};

function _isClerkAPIError(error: unknown): error is ClerkAPIError {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    "longMessage" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    typeof error.longMessage === "string"
  );
}
