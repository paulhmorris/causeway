import type { Environment } from "vitest/environments";
import { builtinEnvironments } from "vitest/environments";

/**
 * jsdom runs in its own JS realm (a `vm` context), so the AbortController/AbortSignal
 * classes it exposes on `global` are structurally identical to Node's but fail
 * cross-realm `instanceof` checks. Node 24's bundled undici (used internally by
 * react-router's fetch-based navigation) enforces that check strictly, so any AbortSignal
 * created under the jsdom environment throws "Expected signal to be an instance of
 * AbortSignal" during tests. Wrap the built-in jsdom environment and restore Node's
 * native AbortController/AbortSignal after jsdom sets up its globals.
 */
const jsdomEnv = builtinEnvironments.jsdom;

export default {
  ...jsdomEnv,
  name: "jsdom",
  async setup(global: typeof globalThis, options: Record<string, unknown>) {
    const NativeAbortController = global.AbortController;
    const NativeAbortSignal = global.AbortSignal;

    const result = await jsdomEnv.setup(global, options);

    global.AbortController = NativeAbortController;
    global.AbortSignal = NativeAbortSignal;

    return {
      teardown(global: typeof globalThis) {
        return result.teardown(global);
      },
    };
  },
} satisfies Environment;
