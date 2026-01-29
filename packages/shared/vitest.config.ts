import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "istanbul",
      exclude: ["src/index.ts", ...coverageConfigDefaults.exclude],
    },
  },
});
