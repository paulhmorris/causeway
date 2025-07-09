import { createReadableStreamFromReadable } from "@react-router/node";
import { renderToPipeableStream } from "react-dom/server";
import type { HandleErrorFunction } from "react-router";
import { ServerRouter } from "react-router";
import "../instrument.server.mjs";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

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
