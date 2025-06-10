/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import { sentryReactRouter, SentryReactRouterBuildOptions } from "@sentry/react-router";
import tailwindcss from "@tailwindcss/vite";
import morgan from "morgan";
import { defineConfig, ViteDevServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const sentryConfig: SentryReactRouterBuildOptions = {
  telemetry: false,
  org: "cosmic-labs",
  project: "causeway",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourceMapsUploadOptions: {
    filesToDeleteAfterUpload: ["**/*.map"],
  },
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
  plugins: [
    morganPlugin(),
    tsconfigPaths(),
    !process.env.VITEST && reactRouter(),
    tailwindcss(),
    ...(isCI ? [sentryReactRouter(sentryConfig, config)] : []),
  ],

  build: {
    sourcemap: !!process.env.CI,
  },

  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/playwright/**",
      "test/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/*.config.*",
    ],
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    coverage: {
      provider: "v8",
      include: ["app/"],
    },
  },
}));

function morganPlugin() {
  return {
    name: "morgan-plugin",
    configureServer(server: ViteDevServer) {
      return () => {
        server.middlewares.use(
          morgan("dev", {
            skip: (req) => {
              if (req.url?.startsWith("/.well-known")) {
                return true;
              }
              if (req.url?.startsWith("/__manifest")) {
                return true;
              }
              return false;
            },
          }),
        );
      };
    },
  };
}
