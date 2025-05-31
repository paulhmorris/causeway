/* eslint-disable @typescript-eslint/no-namespace */
import { loadEnv } from "vite";
import { TypeOf, z } from "zod/v4";

const serverEnvValidation = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  // CI
  CI: z.string().optional(),

  // Remix
  SESSION_SECRET: z.string().min(16),

  // Cloudflare
  R2_BUCKET_NAME: z.string().min(1),
  R2_BUCKET_URL: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),

  // AWS
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().startsWith("tr_"),

  // Playwright
  PLAYWRIGHT_TEST_BASE_URL: z.string().url().optional(),
});

const _deploymentPublicEnvValidation = z.object({
  // Vercel
  VERCEL_URL: z.string(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
});

declare global {
  // Server side
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends TypeOf<typeof serverEnvValidation & typeof _deploymentPublicEnvValidation> {}
  }

  // Client side
  interface Window {
    ENV: TypeOf<typeof _deploymentPublicEnvValidation>;
  }
}

export function validateEnv(): void {
  try {
    const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
    console.info("🌎 validating environment variables..");
    serverEnvValidation.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const tree = z.treeifyError(err);
      const message = tree.errors.join("\n  ");
      throw new Error(`Missing environment variables:\n  ${message}`);
    }
  }
}
