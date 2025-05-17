import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { vercelPreset } from "@vercel/remix/vite";
import morgan from "morgan";
import { ViteDevServer, defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isVercel = process.env.VERCEL === "1";
const isCI = process.env.CI;

export default defineConfig({
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
    remix({
      ...(isVercel && { presets: [vercelPreset()] }),
      ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
    }),
    isCI &&
      sentryVitePlugin({
        telemetry: false,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
  ],

  build: {
    sourcemap: !!process.env.CI,
  },
});

function morganPlugin() {
  return {
    name: "morgan-plugin",
    configureServer(server: ViteDevServer) {
      return () => {
        server.middlewares.use(morgan("tiny"));
      };
    },
  };
}
