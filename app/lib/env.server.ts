/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod/v4";

const _serverEnv = z.object({
  BASE_URL: z.url(),
  EMAIL_FROM_DOMAIN: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]),
  // CI
  CI: z.string().optional(),

  // RR
  SESSION_SECRET: z.string().min(16),

  // Vercel
  CRON_SECRET: z.string().min(16),

  // Cloudflare
  R2_BUCKET_NAME: z.string().min(1),
  R2_BUCKET_URL: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),

  // AWS
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1),

  // Playwright
  PLAYWRIGHT_TEST_BASE_URL: z.url().optional(),
});

const _windowEnv = z.object({
  // Vercel
  VERCEL_URL: z.string(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
});

declare global {
  // Server side
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends z.infer<typeof _serverEnv & typeof _windowEnv> {}
  }

  // Client side
  interface Window {
    ENV: z.infer<typeof _windowEnv>;
  }

  // Vite
  interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_CLERK_SIGN_IN_URL: string;
    readonly VITE_CLERK_SIGN_UP_URL: string;
    readonly VITE_CLERK_SIGN_IN_FORCE_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_UP_FORCE_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: string;
    readonly VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Clerk Session Claims
  interface CustomJwtSessionClaims {
    pem?: string;
  }
}

export const CONFIG = {
  isCI: Boolean(process.env.CI),
  baseUrl: process.env.BASE_URL,
  isTest: process.env.NODE_ENV === "test",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production",
  isPreview: process.env.VERCEL_ENV === "preview" && process.env.NODE_ENV === "production",
  defaultEmailFromAddress: `Team Causeway <no-reply@${process.env.EMAIL_FROM_DOMAIN}>`,
} as const;
