import { createClerkClient } from "@clerk/backend";

export const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

type ClerkAPIError = {
  code: string;
  message: string;
  longMessage: string;
};

export function isClerkAPIError(error: unknown): error is ClerkAPIError {
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
