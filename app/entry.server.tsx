import "../instrument.server.mjs";

import { createReadableStreamFromReadable } from "@react-router/node";
import * as Sentry from "@sentry/react-router";
import { renderToPipeableStream } from "react-dom/server";
import type { HandleErrorFunction } from "react-router";
import { ServerRouter } from "react-router";

import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("ServerEntry");

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.url.includes(".well-known")) {
    return;
  }
  if (!request.signal.aborted) {
    Sentry.captureException(error);
    logger.error(error);
  }
};

const handleRequest = Sentry.createSentryHandleRequest({
  ServerRouter,
  renderToPipeableStream,
  createReadableStreamFromReadable,
});

export default handleRequest;
