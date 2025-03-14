/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { loadEnv } from "vite";
import { TypeOf, z } from "zod";

const serverEnvValidation = z.object({
  BASE_URL: z.string().url(),
  EMAIL_FROM_DOMAIN: z.string(),
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

  // Linear
  LINEAR_API_KEY: z.string().min(1).startsWith("lin_api_"),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().startsWith("tr_"),

  // Playwright
  PLAYWRIGHT_TEST_BASE_URL: z.string().url().optional(),
});

const deploymentPublicEnvValidation = z.object({
  // Vercel
  VERCEL_URL: z.string(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
});

declare global {
  // Server side
  namespace NodeJS {
    interface ProcessEnv extends TypeOf<typeof serverEnvValidation & typeof deploymentPublicEnvValidation> {}
  }

  // Client side
  interface Window {
    ENV: TypeOf<typeof deploymentPublicEnvValidation>;
  }
}

export function validateEnv(): void {
  try {
    const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
    console.info("🌎 validating environment variables..");
    serverEnvValidation.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { fieldErrors } = err.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => (errors ? `${field}: ${errors.join(", ")}` : field))
        .join("\n  ");
      throw new Error(`Missing environment variables:\n  ${errorMessage}`);
    }
  }
}
