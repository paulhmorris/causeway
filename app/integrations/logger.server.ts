/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@axiomhq/pino";
import pino from "pino";

import "pino-pretty";
import { CONFIG } from "~/lib/env.server";

const devTransport: pino.TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    ignore: "pid,hostname",
  },
};

const baseLogger = pino(
  {
    transport: CONFIG.isDev ? devTransport : undefined,
    level: CONFIG.isDev ? "debug" : (process.env.LOG_LEVEL ?? "info"),
    name: "Global",
  },
  CONFIG.isDev
    ? undefined
    : pino.transport({
        target: "@axiomhq/pino",
        options: {
          dataset: process.env.AXIOM_DATASET,
          token: process.env.AXIOM_TOKEN,
        },
      }),
);

export function createLogger(name?: string) {
  return name ? baseLogger.child({ name }) : baseLogger;
}

export const logger = createLogger();
