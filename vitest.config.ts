// Configures foundation tests to run in a Node environment.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/adapters/**/*.test.ts",
      "tests/foundation/**/*.test.ts",
      "tests/domain/**/*.test.ts",
    ],
  },
});
