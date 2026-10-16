import { readFile } from "node:fs/promises";
import { docsLoader } from "@astrojs/starlight/loaders";
import { deriveTitle } from "./derived-title.mjs";

function stripFrontmatter(raw) {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? raw.slice(match[0].length) : raw;
}

/**
 * Astro's glob loader validates each entry against the collection schema via
 * the `parseData` hook it pulls off the loader context, so titles must be
 * injected before the inner loader runs, not after.
 */
export function docsLoaderWithDerivedTitles() {
  const inner = docsLoader();
  return {
    ...inner,
    name: "starlight-docs-loader-with-derived-titles",
    async load(ctx) {
      const { logger, parseData } = ctx;
      await inner.load({
        ...ctx,
        async parseData(entry) {
          if (!entry.data?.title) {
            const raw = await readFile(entry.filePath, "utf8").catch(() => "");
            const title = deriveTitle(stripFrontmatter(raw), entry.id);
            if (title) {
              logger.warn(`derived title "${title}" for ${entry.id}`);
              entry = { ...entry, data: { ...entry.data, title } };
            }
          }
          return parseData(entry);
        },
      });
    },
  };
}
