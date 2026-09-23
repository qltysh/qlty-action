import { fileURLToPath } from "node:url";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^src\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    coverage: {
      provider: "istanbul",
      exclude: ["src/index.ts", ...coverageConfigDefaults.exclude],
    },
  },
});
