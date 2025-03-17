import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@architectlm/core": resolve(__dirname, "../core/src"),
      "@architectlm/extensions": resolve(__dirname, "../extensions/src"),
    },
    extensions: ['.ts', '.js', '.json']
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    deps: {
      inline: [/@architectlm\/(core|extensions)/],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "tests/**"],
    },
  },
});
