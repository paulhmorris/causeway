import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const transport: pino.LoggerOptions["transport"] = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
      },
    }
  : undefined;

const baseLogger = pino({
  transport,
  level: process.env.LOG_LEVEL ?? "debug",
  name: "Global",
});

export function createLogger(name?: string) {
  return name ? baseLogger.child({ name }) : baseLogger;
}

export const logger = createLogger();
