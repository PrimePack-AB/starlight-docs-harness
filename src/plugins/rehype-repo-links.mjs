import fs from "node:fs";
import path from "node:path";
import { slug as githubSlug } from "github-slugger";
import { mountedDirs, rootIndex } from "../mounts.mjs";

const MD_EXT = /\.(md|mdx)$/;

/**
 * Rewrite relative links in docs pages: targets inside mounted docs
 * subdirectories, the docs directory's root index when it has one, and files
 * inside the reserved `files/` subdirectory become site routes; every other
 * relative target becomes an absolute GitHub blob or tree URL against the
 * source repository. Unusable
 * targets (missing files, targets outside the repository) are reported as
 * vfile warnings and otherwise rewritten or left as-is unchanged.
 */
export function rehypeRepoLinks({ docsDir, excludeDirs = ["notes"], baseUrl = "", repoUrl = "", repoRef = "main" }) {
  const mounts = new Set(mountedDirs(docsDir, excludeDirs));
  const landingPage = rootIndex(docsDir);

  const splitFragment = (href) => {
    const index = href.indexOf("#");
    return index === -1 ? [href, ""] : [href.slice(0, index), href.slice(index)];
  };

  const toRoute = (target, fragment, realFile, warn) => {
    const resolved = path.resolve(path.dirname(realFile), target);
    const rel = path.relative(docsDir, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    if (landingPage && rel === landingPage) return `${baseUrl}/${fragment}`;
    if (rel.split(path.sep)[0] === "files") {
      if (!fs.existsSync(resolved)) {
        warn(`files link target does not exist: ${rel}`);
      }
      if (fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) return null;
      const route = rel.split(path.sep).map(encodeURIComponent).join("/");
      return `${baseUrl}/${route}${fragment}`;
    }
    let sourceRel = rel;
    if (!MD_EXT.test(target)) {
      const candidates = [`${resolved}.md`, path.join(resolved, "index.md")];
      const source = candidates.find((candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile());
      if (!source) return null;
      sourceRel = path.relative(docsDir, source);
      if (landingPage && sourceRel === landingPage) return `${baseUrl}/${fragment}`;
    }
    if (!mounts.has(sourceRel.split(path.sep)[0])) return null;
    if (!fs.existsSync(resolved) && !fs.existsSync(path.resolve(docsDir, sourceRel))) {
      warn(`mounted docs link target does not exist: ${sourceRel}`);
    }
    const segments = sourceRel.replace(MD_EXT, "").split(path.sep);
    if (segments.at(-1) === "index") segments.pop();
    const route = segments.map((segment) => githubSlug(segment)).join("/");
    return `${baseUrl}/${route}/${fragment}`;
  };

  const toRepoUrl = (target, fragment, realFile, warn) => {
    if (!repoUrl) return null;
    const resolved = path.resolve(path.dirname(realFile), target);
    const rel = path.relative(path.dirname(docsDir), resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      warn(`link target is outside the repository: ${target}`);
      return null;
    }
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    if (!stat) {
      warn(`repository link target does not exist: ${rel}`);
    }
    const kind = stat?.isDirectory() ? "tree" : "blob";
    const kept = MD_EXT.test(target) ? fragment : "";
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
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return;
      const [encoded, fragment] = splitFragment(href);
      if (encoded === "" || encoded === "." || encoded === "./") return;
      const warn = (message) => {
        file.message(message, node);
        console.warn(`[rehype-repo-links] ${message}`);
      };
      let target;
      try {
        target = decodeURIComponent(encoded);
      } catch {
        warn(`cannot decode percent-encoding in link target: ${encoded}`);
        return;
      }
      const rewritten = toRoute(target, fragment, realFile, warn) ?? toRepoUrl(target, fragment, realFile, warn);
      if (rewritten) node.properties.href = rewritten;
    });
  };
}
