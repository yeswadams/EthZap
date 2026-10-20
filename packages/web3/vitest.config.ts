import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/.git/**", "dist/**", "out/**"],
    testTimeout: 30_000,
    hookTimeout: 45_000,
  },
});
