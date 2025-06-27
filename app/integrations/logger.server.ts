import "@axiomhq/pino";
import pino from "pino";

import { CONFIG } from "~/lib/env.server";

const shouldBeVerbose = CONFIG.isDev || CONFIG.isTest;

const transport: pino.LoggerOptions["transport"] = shouldBeVerbose
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
      },
    }
  : CONFIG.isProd || CONFIG.isPreview
    ? {
        target: "@axiomhq/pino",
        options: {
          dataset: process.env.AXIOM_DATASET,
          token: process.env.AXIOM_TOKEN,
        },
      }
    : undefined;

const baseLogger = pino({
  transport,
  level: shouldBeVerbose ? "debug" : (process.env.LOG_LEVEL ?? "info"),
  name: "Global",
});

export function createLogger(name?: string) {
  return name ? baseLogger.child({ name }) : baseLogger;
}

export const logger = createLogger();
