---
title: "Derived page titles: design"
created: 2026-10-16
---

## Motivation

The first real consumer deployment (herding-cats-with-swords, 2026-10-16) failed its build because seven pages lacked the `title` frontmatter Starlight's schema requires.
The harness promises that consumers keep writing plain markdown; a page without frontmatter failing the build contradicts that promise.
Five of the seven pages carried a faithful first-level heading, and the remaining two were `index` pages whose headings existed but whose filenames were useless as titles — evidence for where a derived title should come from.

## Decisions

The title derives, in order: from the page's first `# ` heading verbatim; else for `index` and `README` entries from their directory name; else from the filename slug.
Hyphens become spaces and the first letter is capitalized in the fallback forms; heading text is used as written.
Empty derivation leaves the entry untouched so the existing schema error still surfaces.
Explicit `title` frontmatter always wins; nothing changes for titled pages.

Integration happens at the loader seam, not the schema.
`docsLoader()` exposes no frontmatter transform and the schema cannot see filenames; Astro's glob loader validates each entry against the schema through the `parseData` hook on the loader context, inside the inner load — so the wrapper intercepts `parseData`, injects a missing title into the raw frontmatter data, and delegates to the real `parseData` before validation sees the entry.
(The original design assumed validation ran after store population; the implementation probe falsified that — the error throws from within `inner.load` — and moved the injection one hook earlier.)
The wrapper reads each file at `entry.filePath` and strips a leading frontmatter block, since the raw file includes frontmatter.

Each derivation logs a warning naming the entry and the derived title, so consumers see what was inferred and can add explicit frontmatter where they want different wording.

## Verification

Vitest unit tests cover every derivation branch (heading, index fallback, README fallback, plain filename, empty).
A CI smoke fixture of untitled pages — one heading-only, one without a heading, one heading-less `index.md` — asserts the build succeeds and the built pages carry the derived titles in their title elements.
Release as `v1.5` after CI is green; consumers on `v1.4` are unaffected until they bump.

## Out of scope

Rewriting or stripping inline markup inside headings, localization of derived titles, and any change to the root-index rules are excluded.
