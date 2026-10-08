import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://primepack-ab.github.io",
  base: process.env.SITE_BASE ?? "/",
  integrations: [
    starlight({
      title: process.env.SITE_TITLE ?? "Docs",
      sidebar: [],
    }),
  ],
});
