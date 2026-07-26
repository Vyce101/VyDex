// Configures the application as a static Astro site.
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { STAGE_ONE_PUBLIC_SITE_ORIGIN } from "./src/adapters/cloudflare-pages-environment";

const ERROR_PAGE_PATH_PATTERN = /^\/(?:404|500)(?:\.html)?\/?$/;

export default defineConfig({
  base: "/",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    sitemap({
      filter: (page) => !ERROR_PAGE_PATH_PATTERN.test(new URL(page).pathname),
    }),
  ],
  output: "static",
  site: STAGE_ONE_PUBLIC_SITE_ORIGIN,
});
