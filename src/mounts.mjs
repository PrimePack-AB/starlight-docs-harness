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

const MERMAID_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*mermaid(?![\w-])/m;
const MARKDOWN_EXTENSIONS = [".md", ".mdx"];

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true }).flatMap((entry) => {
    const file = path.join(entry.parentPath, entry.name);
    const isFile = fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
    return isFile && MARKDOWN_EXTENSIONS.includes(path.extname(entry.name)) ? [file] : [];
  });
}

/**
 * Whether any page that renders from the docs directory (the mounted
 * subdirectories and the root index) contains a fenced mermaid block.
 */
export function hasMermaid(docsDir, excludeDirs) {
  const index = rootIndex(docsDir);
  const files = [
    ...(index ? [path.join(docsDir, index)] : []),
    ...mountedDirs(docsDir, excludeDirs).flatMap((dir) => markdownFiles(path.join(docsDir, dir))),
  ];
  return files.some((file) => MERMAID_FENCE.test(fs.readFileSync(file, "utf8")));
}
