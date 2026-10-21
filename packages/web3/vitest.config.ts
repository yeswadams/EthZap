import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Explicitly exclude build directories from being picked up as tests
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    // Ensure it only runs your true source code files
    include: ["src/**/*.{test,spec}.ts"],
  },
});
