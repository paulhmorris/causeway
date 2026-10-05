import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "unicorn", "oxc", "import", "vitest", "promise", "react-perf", "react"],
  categories: {
    correctness: "error",
  },
  rules: {
    "vitest/require-mock-type-parameters": "off",
  },
  env: {
    builtin: true,
  },
  options: {
    typeAware: true,
  },
  overrides: [
    {
      files: ["**.test.{ts,tsx}"],
      rules: {
        "typescript/unbound-method": "off",
      },
    },
  ],
});
