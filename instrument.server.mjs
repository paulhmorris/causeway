/* eslint-disable no-undef */
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import * as Sentry from "@sentry/react-router";

Sentry.init({
  dsn: "https://f18051d71458f411f51af7ca0308b1cb@o4505496663359488.ingest.us.sentry.io/4506395673886720",
  environment: process.env.VERCEL_ENV,
  enabled: process.env.NODE_ENV === "production",

  sampleRate: 1.0,

  tracesSampleRate: 0.5,
  profileSessionSampleRate: 0.5,
  profileLifecycle: "trace",

  sendDefaultPii: true,
  integrations: [nodeProfilingIntegration(), Sentry.prismaIntegration()],
});
