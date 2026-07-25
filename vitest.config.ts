// Configures foundation tests to run in a Node environment.
import { getViteConfig } from "astro/config";
import type { ViteUserConfig } from "vitest/config";

const vitestConfig = {
  test: {
    environment: "node",
    include: [
      "tests/adapters/**/*.test.ts",
      "tests/components/**/*.test.ts",
      "tests/features/**/*.test.ts",
      "tests/foundation/**/*.test.ts",
      "tests/domain/**/*.test.ts",
    ],
  },
} satisfies ViteUserConfig;

export default getViteConfig(vitestConfig);
