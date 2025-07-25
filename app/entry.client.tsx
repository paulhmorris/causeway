/* eslint-disable import/namespace */
import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: "https://f18051d71458f411f51af7ca0308b1cb@o4505496663359488.ingest.us.sentry.io/4506395673886720",
  enabled: window.location.hostname !== "localhost",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  environment: window.ENV?.VERCEL_ENV,

  sampleRate: 1.0,
  tracesSampleRate: 0.25,
  profilesSampleRate: 0.25,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1,
  sendDefaultPii: true,

  integrations: [
    Sentry.reactRouterTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, maskAllInputs: false }),
  ],
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
