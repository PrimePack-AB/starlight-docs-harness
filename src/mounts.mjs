import fs from "node:fs";
import path from "node:path";

export function mountedDirs(docsDir, excludeDirs) {
  return fs
    .readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !excludeDirs.includes(entry.name))
    .filter((entry) => fs.statSync(path.join(docsDir, entry.name), { throwIfNoEntry: false })?.isDirectory() ?? false)
    .map((entry) => entry.name)
    .sort();
}
