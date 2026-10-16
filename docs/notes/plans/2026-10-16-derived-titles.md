---
title: "Derived page titles: implementation plan"
created: 2026-10-16
---

# Derived Page Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pages without `title` frontmatter build successfully, their titles derived from the first heading, the directory name for index/README pages, or the filename.

**Architecture:** A pure `deriveTitle(body, id)` module (vitest-tested) plus a loader wrapper around Starlight's `docsLoader()` that injects derived titles into the content store post-load, before schema validation. Explicit titles always win.

**Tech Stack:** Astro content layer loaders, Starlight docsLoader, vitest, Biome, GitHub Actions.

**Spec:** `docs/notes/architecture/2026-10-16-derived-titles-design.md`

**Working context:** branch `derived-titles` (checked out). Repo root: `/home/joaqim/projects/starlight-docs-harness`. Atomic conventional commits per task. Local checks: `bun run check`, `bun run test`.

## File structure

- Create `src/derived-title.mjs` — pure derivation function.
- Create `tests/derived-title.test.mjs` — vitest unit tests.
- Create `src/derived-title-loader.mjs` — wrapping loader (imports the function, wraps `docsLoader()`).
- Modify `src/content.config.ts` — swap `docsLoader()` for the wrapper import.
- Create `tests/sample-docs-untitled/docs/**` — smoke fixture of untitled pages.
- Modify `.github/workflows/ci.yml` — smoke build step for the untitled fixture.
- Modify `README.md` — "Page titles" section.

---

### Task 1: Derivation module (TDD)

**Files:**
- Create: `src/derived-title.mjs`
- Test: `tests/derived-title.test.mjs`

- [ ] **Step 1: Write the failing test** — create `tests/derived-title.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { deriveTitle } from "../src/derived-title.mjs";

describe("deriveTitle", () => {
  it("uses the first heading verbatim", () => {
    expect(deriveTitle("intro\n\n# Real Title\n\ntext\n# Later\n", "guides/page")).toBe("Real Title");
  });

  it("falls back to the directory name for index entries", () => {
    expect(deriveTitle("body text only", "development/architecture/index")).toBe("Architecture");
  });

  it("falls back to the directory name for readme entries", () => {
    expect(deriveTitle("body text only", "development/traceability/beads-archive/readme")).toBe("Beads archive");
  });

  it("derives a top-level index from its sole segment", () => {
    expect(deriveTitle("body", "reference/index")).toBe("Reference");
  });

  it("sentence-cases the filename slug", () => {
    expect(deriveTitle("body", "guides/verification-layers")).toBe("Verification layers");
  });

  it("returns an empty string when nothing derives", () => {
    expect(deriveTitle("body", "index")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun run test` — FAIL: cannot resolve `../src/derived-title.mjs`.
- [ ] **Step 3: Write minimal implementation** — create `src/derived-title.mjs`:

```js
export function deriveTitle(body, id) {
  const heading = body.match(/^#\s+(.+?)\s*$/m);
  if (heading) {
    return heading[1];
  }
  const segments = id.split("/").filter(Boolean);
  let last = segments.pop() ?? "";
  if (last === "index" || last === "readme") {
    const parent = segments.pop();
    if (parent === undefined) {
      return "";
    }
    last = parent;
  }
  const words = last.replaceAll("-", " ").trim();
  if (!words) {
    return "";
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}
```

- [ ] **Step 4: Run test to verify it passes** — `bun run test` — all suites green (existing 35 + 6 new).
- [ ] **Step 5: Commit**

```bash
git add src/derived-title.mjs tests/derived-title.test.mjs
git commit -m "feat: derive page titles when frontmatter omits one"
```

### Task 2: Untitled-fixture CI smoke (the failing integration test)

**Files:**
- Create: `tests/sample-docs-untitled/docs/guides/h1-only.md`
- Create: `tests/sample-docs-untitled/docs/concepts/no-heading.md`
- Create: `tests/sample-docs-untitled/docs/reference/index.md`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the fixture** — three files, none with frontmatter:

`tests/sample-docs-untitled/docs/guides/h1-only.md`:

```markdown
# H1 Only Guide

Body text without any frontmatter.
```

`tests/sample-docs-untitled/docs/concepts/no-heading.md`:

```markdown
Body text without a heading or frontmatter.
```

`tests/sample-docs-untitled/docs/reference/index.md`:

```markdown
Body text in an index page without a heading.
```

- [ ] **Step 2: Confirm the build fails today** — run locally:

```bash
DOCS_DIR="$PWD/tests/sample-docs-untitled/docs" EXCLUDE_DIRS=notes \
SITE_URL=https://example.pages.dev SITE_BASE=/ \
REPO_URL=https://github.com/PrimePack-AB/starlight-docs-harness \
bun run build
```

Expected: FAIL with `InvalidContentEntryDataError ... title: Required` — this is the bug being fixed; record the failure.

- [ ] **Step 3: Add the CI smoke step** — in `.github/workflows/ci.yml` `check` job, after the existing smoke steps:

```yaml
      - name: Smoke build against untitled sample docs
        env:
          DOCS_DIR: ${{ github.workspace }}/tests/sample-docs-untitled/docs
          EXCLUDE_DIRS: notes
          SITE_BASE: /
          REPO_URL: ${{ github.server_url }}/${{ github.repository }}
        run: |
          bun run build
          grep -q '>H1 Only Guide<' dist/guides/h1-only/index.html
          grep -q '>No heading<' dist/concepts/no-heading/index.html
          grep -q '>Reference<' dist/reference/index.html
```

- [ ] **Step 4: Commit**

```bash
git add tests/sample-docs-untitled .github/workflows/ci.yml
git commit -m "test: smoke-build untitled docs pages in CI"
```

This step is red until Task 3 lands — same ordering intent as the v1.4 cloudflare self-test.

### Task 3: Loader wrapper and wiring

**Files:**
- Create: `src/derived-title-loader.mjs`
- Modify: `src/content.config.ts`

- [ ] **Step 1: Create the wrapper** — `src/derived-title-loader.mjs`:

```js
import { readFile } from "node:fs/promises";
import { docsLoader } from "@astrojs/starlight/loaders";
import { deriveTitle } from "./derived-title.mjs";

export function docsLoaderWithDerivedTitles() {
  const inner = docsLoader();
  return {
    ...inner,
    name: "starlight-docs-loader-with-derived-titles",
    async load(ctx) {
      await inner.load(ctx);
      for (const [id, entry] of ctx.store.entries()) {
        if (entry.data?.title) {
          continue;
        }
        const body =
          typeof entry.body === "string"
            ? entry.body
            : await readFile(entry.filePath, "utf8").catch(() => "");
        const title = deriveTitle(body, id);
        if (!title) {
          continue;
        }
        ctx.logger.warn(`derived title "${title}" for ${id}`);
        ctx.store.set({ ...entry, id, data: { ...entry.data, title } });
      }
    },
  };
}
```

- [ ] **Step 2: Probe the store shape** — before trusting Step 1's `store.set` call, temporarily add `console.log(JSON.stringify([...ctx.store.entries()][0]))` inside the loop, run the Task 2 local build, and inspect: confirm `entry.body` or `entry.filePath` is present and that `store.set({ ...entry, id, ... })` persists (the build now succeeds and the log shows the derived titles). Adjust the `set` call to whatever shape Astro's store actually requires (some versions key entries internally), then remove the probe log.
- [ ] **Step 3: Wire it in** — `src/content.config.ts`: replace `import { docsLoader } from "@astrojs/starlight/loaders";` with `import { docsLoaderWithDerivedTitles } from "./derived-title-loader.mjs";` and change `loader: docsLoader()` to `loader: docsLoaderWithDerivedTitles()`.
- [ ] **Step 4: Run the Task 2 build locally** — the exact Step 2 command from Task 2 now succeeds; all three grep assertions pass against `dist`.
- [ ] **Step 5: Full local checks** — `bun run check && bun run test` — green.
- [ ] **Step 6: Commit**

```bash
git add src/derived-title-loader.mjs src/content.config.ts
git commit -m "feat: inject derived titles at the content loader seam"
```

### Task 4: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** After the "How content mounts" section, insert:

```markdown
## Page titles

Every page renders with a title.
Explicit `title` frontmatter wins; without one the harness derives the title from the page's first `# ` heading, falling back to the directory name for `index` and `README` pages and to the filename otherwise.
The build log names each derived title, so add explicit frontmatter wherever the derived wording is not what you want.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document derived page titles"
```

### Task 5: Release

- [ ] **Step 1:** Push the branch, open a draft PR (`feat: derive page titles for untitled pages`), watch all CI jobs green (`check` including the new smoke step, `self-test`, `self-test-cloudflare`).
- [ ] **Step 2:** Merge (user's call or ff per instruction), then tag `v1.5` annotated on the merge commit and push the tag.
- [ ] **Step 3:** Retire these working notes (design + plan + index update), one docs commit, mirroring the v1.4 closeout.

---

## Self-review notes

- Spec coverage: derivation rules (Task 1), loader seam with body-or-filePath fallback (Task 3), warning log (Task 3), explicit-title precedence (Tasks 1/3), README (Task 4), smoke fixture (Task 2), release (Task 5). Out-of-scope items absent.
- Placeholder scan: none; Task 3 Step 2 is a bounded empirical probe with defined success criteria, not an open question.
- Type consistency: `deriveTitle(body, id)` and `docsLoaderWithDerivedTitles` names match across tasks; fixture paths match between Task 2 and Task 3 verification.
