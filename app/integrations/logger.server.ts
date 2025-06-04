import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "debug",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        }
      : undefined,
});
