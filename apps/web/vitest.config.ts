import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Only pick up vitest unit/integration tests under tests/. e2e/** uses
    // @playwright/test and crashes at module load if vitest tries to load it.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
