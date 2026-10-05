import { clerkSetup } from "@clerk/testing/playwright";

/** Runs in the main process so every worker inherits the Clerk testing token env. */
export default async function globalSetup() {
  await clerkSetup({ publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY });
}
