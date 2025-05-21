import { reactRouter } from "@react-router/dev/vite";
import { sentryReactRouter, SentryReactRouterBuildOptions } from "@sentry/react-router";
import morgan from "morgan";
import { defineConfig, ViteDevServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const sentryConfig: SentryReactRouterBuildOptions = {
  telemetry: false,
  org: "cosmic-labs",
  project: "np-ally",
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

const isCI = process.env.CI;

export default defineConfig((config) => ({
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
  server: {
    port: 3000,
  },
  plugins: [morganPlugin(), tsconfigPaths(), reactRouter(), ...(isCI ? [sentryReactRouter(sentryConfig, config)] : [])],

  build: {
    sourcemap: !!process.env.CI,
  },
}));

function morganPlugin() {
  return {
    name: "morgan-plugin",
    configureServer(server: ViteDevServer) {
      return () => {
        server.middlewares.use(morgan("dev"));
      };
    },
  };
}
