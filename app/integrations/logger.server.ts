import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogAttributes = Record<string, unknown>;
type LogFn = (message: string, attributes?: LogAttributes) => void;
export type ServerLogger = Record<LogLevel, LogFn>;

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel: LogLevel = CONFIG.isDev ? "debug" : "info";

const consoleLog: Record<LogLevel, (...args: Array<unknown>) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Test runs shouldn't add noise or cost to Sentry Logs.
const sentryEnabled = !CONFIG.isTest;

const sentryLog: Record<LogLevel, LogFn> = {
  debug: (message, attributes) => Sentry.logger.debug(message, attributes),
  info: (message, attributes) => Sentry.logger.info(message, attributes),
  warn: (message, attributes) => Sentry.logger.warn(message, attributes),
  error: (message, attributes) => Sentry.logger.error(message, attributes),
};

// Sentry log attributes are meant to be primitives. Flatten Errors to their message
// (plus a separate `.stack` attribute) and JSON-encode any remaining objects so nested
// data is preserved rather than serialized as "[object Object]".
function normalizeAttributes(attributes: LogAttributes): LogAttributes {
  const normalized: LogAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value instanceof Error) {
      normalized[key] = value.message;
      if (value.stack) normalized[`${key}.stack`] = value.stack;
    } else if (value !== null && typeof value === "object") {
      normalized[key] = JSON.stringify(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

interface LoggerOptions {
  sentryLevels?: ReadonlySet<LogLevel>;
}

const ALL_LEVELS: ReadonlySet<LogLevel> = new Set(["debug", "info", "warn", "error"]);

function buildLogger(module: string, options: LoggerOptions = {}): ServerLogger {
  const sentryLevels = options.sentryLevels ?? ALL_LEVELS;

  const at =
    (level: LogLevel): LogFn =>
    (message, attributes) => {
      if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

      consoleLog[level](`[${module}] ${message}`, attributes ?? "");

      if (sentryEnabled && sentryLevels.has(level)) {
        sentryLog[level](message, {
          module,
          environment: process.env.VERCEL_ENV,
          ...(attributes && normalizeAttributes(attributes)),
        });
      }
    };

  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

export function createLogger(module: string): ServerLogger {
  return buildLogger(module);
}

// Request/response logging fires on every non-asset request, so only warn (redirects) and
// error (4xx/5xx) reach Sentry Logs. Routine info request/response lines stay in stdout,
// where Vercel captures them, keeping Sentry Logs volume (and cost) down.
export const httpLogger = buildLogger("Http", { sentryLevels: new Set(["warn", "error"]) });
