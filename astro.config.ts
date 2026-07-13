// Configures the application as a static Astro site.
import { defineConfig } from "astro/config";

export default defineConfig({
  base: "/",
  devToolbar: {
    enabled: false,
  },
  output: "static",
});
