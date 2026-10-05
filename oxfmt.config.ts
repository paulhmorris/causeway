import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 120,
  sortImports: true,
  sortTailwindcss: true,
  ignorePatterns: [".env", "build/**", "public/**", ".react-router/**", "playwright/**"],
});
