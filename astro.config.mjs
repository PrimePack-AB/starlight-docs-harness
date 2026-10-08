import fs from "node:fs";
import path from "node:path";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const root = process.cwd();
const docsDir = path.resolve(root, process.env.DOCS_DIR ?? "../karrio-dhl-freight-sweden/docs");
const excludeDirs = (process.env.EXCLUDE_DIRS ?? "notes")
  .split(",")
  .map((dir) => dir.trim())
  .filter(Boolean);

const mountedDirs = fs.existsSync(docsDir)
  ? fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !excludeDirs.includes(entry.name))
      .map((entry) => entry.name)
      .sort()
  : [];

const sidebar = mountedDirs.map((dir) => ({
  label: dir.charAt(0).toUpperCase() + dir.slice(1),
  autogenerate: { directory: dir },
}));

export default defineConfig({
  site: process.env.SITE_URL ?? "https://primepack-ab.github.io",
  base: process.env.SITE_BASE ?? "/",
  integrations: [
    starlight({
      title: process.env.SITE_TITLE ?? "Docs",
      sidebar,
    }),
  ],
});
