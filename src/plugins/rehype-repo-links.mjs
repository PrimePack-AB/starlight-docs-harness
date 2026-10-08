import fs from "node:fs";
import path from "node:path";
import { mountedDirs } from "../mounts.mjs";

/**
 * Rewrite relative links in docs pages: targets inside mounted docs
 * subdirectories become site routes; every other relative target becomes an
 * absolute GitHub blob or tree URL against the source repository.
 */
export function rehypeRepoLinks({ docsDir, excludeDirs = ["notes"], baseUrl = "", repoUrl = "", repoRef = "main" }) {
  const mounts = new Set(mountedDirs(docsDir, excludeDirs));

  const splitFragment = (href) => {
    const index = href.indexOf("#");
    return index === -1 ? [href, ""] : [href.slice(0, index), href.slice(index)];
  };

  const toRoute = (href, realFile) => {
    const [target, fragment] = splitFragment(href);
    if (!/\.(md|mdx)$/.test(target)) return null;
    const resolved = path.resolve(path.dirname(realFile), target);
    const rel = path.relative(docsDir, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    if (!mounts.has(rel.split(path.sep)[0])) return null;
    const route = rel.replace(/\.(md|mdx)$/, "").replace(/\/?index$/, "");
    return `${baseUrl}/${route}/${fragment}`;
  };

  const toRepoUrl = (href, realFile) => {
    if (!repoUrl) return null;
    const [target, fragment] = splitFragment(href);
    const resolved = path.resolve(path.dirname(realFile), target);
    const rel = path.relative(path.dirname(docsDir), resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    const kind = stat?.isDirectory() ? "tree" : "blob";
    const kept = target.endsWith(".md") ? fragment : "";
    return `${repoUrl}/${kind}/${repoRef}/${rel}${kept}`;
  };

  const walk = (node, visit) => {
    if (node.type === "element") visit(node);
    for (const child of node.children ?? []) walk(child, visit);
  };

  return (tree, file) => {
    const logical = file.history?.[0] ?? file.path;
    if (!logical) return;
    const absolute = path.resolve(process.cwd(), logical);
    if (!fs.existsSync(absolute)) return;
    const realFile = fs.realpathSync(absolute);
    const inDocs = path.relative(docsDir, realFile);
    if (inDocs.startsWith("..") || path.isAbsolute(inDocs)) return;

    walk(tree, (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return;
      const rewritten = toRoute(href, realFile) ?? toRepoUrl(href, realFile);
      if (rewritten) node.properties.href = rewritten;
    });
  };
}
