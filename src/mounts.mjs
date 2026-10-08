import fs from "node:fs";
import path from "node:path";

export const ROOT_INDEX_NAMES = ["index.md", "index.mdx"];

export function mountedDirs(docsDir, excludeDirs) {
  return fs
    .readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !excludeDirs.includes(entry.name))
    .filter((entry) => fs.statSync(path.join(docsDir, entry.name), { throwIfNoEntry: false })?.isDirectory() ?? false)
    .map((entry) => entry.name)
    .sort();
}

/**
 * Name of the docs directory's own landing page (`index.md` or `index.mdx`),
 * or null when the harness's bundled landing page applies.
 */
export function rootIndex(docsDir) {
  const found = ROOT_INDEX_NAMES.filter(
    (name) => fs.statSync(path.join(docsDir, name), { throwIfNoEntry: false })?.isFile() ?? false,
  );
  if (found.length > 1) {
    throw new Error(`${docsDir} has both ${found.join(" and ")}; keep one root index`);
  }
  return found[0] ?? null;
}
