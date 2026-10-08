import fs from "node:fs";
import path from "node:path";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";
import { hasMermaid, mountedDirs } from "./src/mounts.mjs";
import { rehypeRepoLinks } from "./src/plugins/rehype-repo-links.mjs";

const root = process.cwd();
const docsDir = path.resolve(root, process.env.DOCS_DIR ?? "../karrio-dhl-freight-sweden/docs");
const excludeDirs = (process.env.EXCLUDE_DIRS ?? "notes")
  .split(",")
  .map((dir) => dir.trim())
  .filter(Boolean);

if (!fs.existsSync(docsDir)) {
  throw new Error(`DOCS_DIR does not exist: ${docsDir}`);
}

const mounts = mountedDirs(docsDir, excludeDirs);

if (mounts.length === 0) {
  throw new Error(`no mountable docs directories in ${docsDir}`);
}

const sidebar = mounts.map((dir) => ({
  label: dir.charAt(0).toUpperCase() + dir.slice(1),
  autogenerate: { directory: dir },
}));

export default defineConfig({
  site: process.env.SITE_URL ?? "https://primepack-ab.github.io",
  base: process.env.SITE_BASE ?? "/",
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
  markdown: {
    rehypePlugins: [
      [
        rehypeRepoLinks,
        {
          docsDir,
          excludeDirs,
          baseUrl: process.env.SITE_BASE?.replace(/\/$/, "") ?? "",
          repoUrl: process.env.REPO_URL ?? "",
          repoRef: process.env.REPO_REF ?? "main",
        },
      ],
    ],
  },
  integrations: [
    ...(hasMermaid(docsDir, excludeDirs) ? [mermaid({ theme: "default", autoTheme: true })] : []),
    starlight({
      title: process.env.SITE_TITLE ?? "Docs",
      sidebar,
    }),
  ],
});
