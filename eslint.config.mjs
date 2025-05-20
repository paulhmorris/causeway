/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  prettier,

  // global rules
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
    },
  },

  // global ignores
  { ignores: ["build/", "public/", "playwright/", "node_modules/", "test-results", "*.env"] },

  // global language options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Typescript
  {
    files: ["**/*.{ts,tsx}"],
    extends: [importPlugin.flatConfigs.recommended, importPlugin.flatConfigs.typescript],
    settings: {
      "import/internal-regex": "^~/",
      "import/resolver": {
        node: {
          extensions: [".ts", ".tsx"],
        },
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "no-throw-literal": "off",
      "@typescript-eslint/consistent-type-definitions": ["off"],
      "@typescript-eslint/array-type": ["error", { default: "generic" }],
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "import/order": [
        "error",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          "newlines-between": "always",
        },
      ],
    },
  },

  // React
  {
    files: ["**/*.{js,ts,jsx,tsx}"],
    plugins: {
      react,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    rules: {
      "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
      "react/prop-types": "off",
    },
    settings: {
      formComponents: ["Form"],
      linkComponents: [
        { linkAttribute: "to", name: "Link" },
        { linkAttribute: "to", name: "NavLink" },
      ],
      react: {
        version: "detect",
      },
    },
  },

  // Playwright
  {
    files: ["test/e2e/*.ts"],
    ...playwright.configs["flat/recommended"],
  },
);
