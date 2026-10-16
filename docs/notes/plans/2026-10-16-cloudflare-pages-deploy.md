---
title: "Cloudflare Pages deployment: implementation plan"
created: 2026-10-16
---

# Cloudflare Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `deploy-target: cloudflare` path that builds the same Starlight site and deploys it to Cloudflare Pages with wrangler, leaving the default GitHub Pages flow untouched.

**Architecture:** All target orchestration stays in `action.yml`; the only new harness code is a dependency-free `scripts/pages-project-name.mjs` deriving the Pages project name (testable under vitest, called from the action's bash). Wrangler ships as a pinned devDependency so `bun install --frozen-lockfile` fixes its version. CI gains a Cloudflare-mode self-test that expects the missing-token guard to fail fast and asserts the root-base build.

**Tech Stack:** GitHub Actions composite action, bash, Bun, wrangler v4 (Cloudflare Pages direct upload), vitest, Biome.

**Spec:** `docs/notes/architecture/2026-10-16-cloudflare-pages-deploy-design.md`

**Verified external facts** (Cloudflare docs, checked 2026-10-16):
- `wrangler pages deploy` has no `--dry-run` flag.
- `wrangler pages deploy` prompts interactively when the project does not exist, so CI must pre-attempt `wrangler pages project create` (idempotent `|| true` pattern); real auth/network errors still surface in the deploy.
- CI auth needs `CLOUDFLARE_API_TOKEN` (Pages `Edit` permission) and optionally `CLOUDFLARE_ACCOUNT_ID` as environment — wrangler reads both natively.

**Working context:** branch `cloudflare-pages-deploy` (already checked out). Repo root: `/home/joaqim/projects/starlight-docs-harness`. Commits are atomic per task, conventional-commit style matching `git log --oneline` history.

## File structure

- Modify `package.json`, `bun.lock` — pin `wrangler` as devDependency.
- Create `scripts/pages-project-name.mjs` — pure derivation of the Pages project name; CLI when run directly, importable under vitest.
- Create `tests/pages-project-name.test.mjs` — vitest unit tests for the derivation.
- Modify `action.yml` — new inputs, per-target `SITE_URL`/`SITE_BASE` derivation, conditional artifact upload, guarded wrangler deploy step.
- Modify `.github/workflows/ci.yml` — new `self-test-cloudflare` job.
- Modify `README.md` — Cloudflare deployment section, input table rows, default-derivation notes, version pointers.

---

### Task 1: Pin wrangler as a devDependency

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add wrangler**

Run: `cd /home/joaqim/projects/starlight-docs-harness && bun add -d wrangler`

Expected: `package.json` gains `"wrangler": "^4..."` in `devDependencies`; `bun.lock` updates. Zero-import scripts mean no other file changes.

- [ ] **Step 2: Verify the pinned binary resolves**

Run: `bunx wrangler --version`

Expected: prints `4.x.y` matching the version written to `package.json`. No login prompt, no network auth.

- [ ] **Step 3: Run repo checks**

Run: `bun run check && bun run test`

Expected: both pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "build: pin wrangler for the cloudflare pages deploy path"
```

### Task 2: Pages project-name derivation (TDD)

**Files:**
- Create: `scripts/pages-project-name.mjs`
- Test: `tests/pages-project-name.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/pages-project-name.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { pagesProjectName } from "../scripts/pages-project-name.mjs";

describe("pagesProjectName", () => {
  it("uses the explicit project name verbatim", () => {
    expect(pagesProjectName("custom-name", "owner/Some_Repo")).toBe("custom-name");
  });

  it("derives from the repository name segment", () => {
    expect(pagesProjectName("", "PrimePack-AB/starlight-docs-harness")).toBe("starlight-docs-harness");
  });

  it("lowercases and collapses non-alphanumerics into hyphens", () => {
    expect(pagesProjectName("", "owner/My_Cool.Repo")).toBe("my-cool-repo");
  });

  it("trims leading and trailing hyphens", () => {
    expect(pagesProjectName("", "owner/__repo__")).toBe("repo");
  });

  it("returns an empty string when nothing derives", () => {
    expect(pagesProjectName("", "owner/___")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test`

Expected: FAIL — cannot resolve `../scripts/pages-project-name.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/pages-project-name.mjs`:

```js
export function pagesProjectName(explicit, repository) {
  const repoSegment = repository.split("/").pop() ?? "";
  return (explicit || repoSegment)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

if (import.meta.main) {
  const name = pagesProjectName(process.argv[2] ?? "", process.argv[3] ?? "");
  if (!name) {
    console.error("could not derive a Cloudflare Pages project name");
    process.exit(1);
  }
  console.log(name);
}
```

`import.meta.main` is only truthy under `bun <file>`, so importing under vitest prints nothing.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test`

Expected: PASS, all suites green.

- [ ] **Step 5: Verify the CLI form the action will use**

Run: `bun scripts/pages-project-name.mjs "" "PrimePack-AB/starlight-docs-harness" && bun scripts/pages-project-name.mjs "custom" "x/y"`

Expected: prints `starlight-docs-harness`, then `custom`.

- [ ] **Step 6: Run repo checks**

Run: `bun run check`

Expected: PASS (Biome accepts the new files; run `bun run format` if it flags formatting).

- [ ] **Step 7: Commit**

```bash
git add scripts/pages-project-name.mjs tests/pages-project-name.test.mjs
git commit -m "feat: derive the cloudflare pages project name"
```

### Task 3: Cloudflare-mode CI self-test (the failing integration test)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect a root-base build locally to fix the site-URL assertion**

Run:

```bash
cd /home/joaqim/projects/starlight-docs-harness && \
DOCS_DIR="$PWD/tests/sample-docs/docs" EXCLUDE_DIRS=notes \
SITE_URL=https://starlight-docs-harness.pages.dev SITE_BASE=/ \
REPO_URL=https://github.com/PrimePack-AB/starlight-docs-harness \
bun run build && \
grep -o 'https://starlight-docs-harness.pages.dev[^"]*' dist/index.html | sort -u | head
```

Expected: build succeeds; the grep lists at least one URL (canonical or Open Graph) — if it lists nothing, the CI assertion in Step 2 becomes the negative form `! grep -q 'github.io' dist/index.html` instead of the positive pages.dev grep.

- [ ] **Step 2: Add the self-test job**

Append to `.github/workflows/ci.yml` jobs (after `self-test`):

```yaml
  self-test-cloudflare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - id: cloudflare
        continue-on-error: true
        uses: ./
        with:
          docs-dir: tests/sample-docs/docs
          deploy-target: cloudflare
      - name: Assert the deploy failed fast without a token
        run: test "${{ steps.cloudflare.outcome }}" = failure
      - name: Assert the cloudflare-mode build
        run: |
          grep -q 'https://starlight-docs-harness.pages.dev' dist/index.html
          grep -q 'href="/favicon.svg"' dist/index.html
          grep -q 'href="/guides/sample-guide/"' dist/concepts/sample-concept/index.html
      - name: Assert the pinned wrangler resolves
        run: bunx wrangler --version
```

Substitute the negative-form assertion here if Step 1 found no pages.dev URL. `continue-on-error` lets the job inspect the guard's failure; the build step has already written `dist` into the workspace (`github.action_path` equals the workspace for `uses: ./`).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "test: self-test the cloudflare deploy target in CI"
```

This job fails until Task 4 lands (the `deploy-target` input does nothing yet, so the action succeeds instead of failing the guard, and the derived `SITE_URL` stays `github.io`). It goes green only after the action implements the target — that ordering is the point.

### Task 4: Implement the cloudflare deploy path in the action

**Files:**
- Modify: `action.yml`

- [ ] **Step 1: Replace action.yml with the target-aware version**

Write `action.yml` as:

```yaml
name: starlight-docs-harness
description: Build a Starlight site from a repository's docs/ directory and deploy it to GitHub Pages or Cloudflare Pages.
inputs:
  docs-dir:
    description: Docs directory relative to the repository root.
    default: docs
  exclude:
    description: Comma-separated docs subdirectories excluded from the site.
    default: notes
  title:
    description: Site title. Defaults to the repository name.
    default: ''
  base:
    description: Site base path. Defaults to /<repository-name> for project pages and / for Cloudflare Pages.
    default: ''
  repo-url:
    description: Repository web URL used to rewrite repo-relative links. Defaults to the consumer repository.
    default: ''
  repo-ref:
    description: Repository ref used to rewrite repo-relative links; with deploy-target cloudflare also the deployed branch.
    default: main
  deploy-target:
    description: Deployment target. github-pages uploads the Pages artifact; cloudflare deploys with wrangler.
    default: github-pages
  project-name:
    description: Cloudflare Pages project name. Defaults to the repository name lowercased with non-alphanumerics collapsed to hyphens.
    default: ''
runs:
  using: composite
  steps:
    - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
      with:
        bun-version-file: ${{ github.action_path }}/package.json
    - name: Build site
      shell: bash
      working-directory: ${{ github.action_path }}
      env:
        DOCS_DIR: ${{ github.workspace }}/${{ inputs.docs-dir }}
        EXCLUDE_DIRS: ${{ inputs.exclude }}
        SITE_TITLE: ${{ inputs.title }}
        SITE_BASE: ${{ inputs.base }}
        REPO_URL: ${{ inputs.repo-url }}
        REPO_REF: ${{ inputs.repo-ref }}
        DEPLOY_TARGET: ${{ inputs.deploy-target }}
        PROJECT_NAME: ${{ inputs.project-name }}
      run: |
        case "$DEPLOY_TARGET" in
          github-pages|cloudflare) ;;
          *)
            echo "deploy-target must be github-pages or cloudflare, got '$DEPLOY_TARGET'" >&2
            exit 1
            ;;
        esac
        if [ "$DEPLOY_TARGET" = cloudflare ]; then
          project_name="$(bun scripts/pages-project-name.mjs "$PROJECT_NAME" "${GITHUB_REPOSITORY##*/}")"
          echo "HARNESS_PROJECT_NAME=$project_name" >> "$GITHUB_ENV"
          export SITE_URL="${SITE_URL:-https://${project_name}.pages.dev}"
          export SITE_BASE="${SITE_BASE:-/}"
        else
          export SITE_URL="${SITE_URL:-https://${GITHUB_REPOSITORY_OWNER}.github.io}"
          export SITE_BASE="${SITE_BASE:-/${GITHUB_REPOSITORY##*/}}"
        fi
        export SITE_TITLE="${SITE_TITLE:-${GITHUB_REPOSITORY##*/}}"
        export REPO_URL="${REPO_URL:-${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}}"
        bun install --frozen-lockfile
        bun run build
    - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
      if: ${{ inputs.deploy-target == 'github-pages' }}
      with:
        path: ${{ github.action_path }}/dist
    - name: Deploy to Cloudflare Pages
      if: ${{ inputs.deploy-target == 'cloudflare' }}
      shell: bash
      working-directory: ${{ github.action_path }}
      env:
        REPO_REF: ${{ inputs.repo-ref }}
      run: |
        if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
          echo 'deploy-target is cloudflare but CLOUDFLARE_API_TOKEN is not set.' >&2
          echo 'Add it to the environment of the job or step from the repository secrets:' >&2
          echo '  CLOUDFLARE_API_TOKEN: <secrets.CLOUDFLARE_API_TOKEN>' >&2
          exit 1
        fi
        node_modules/.bin/wrangler pages project create "${HARNESS_PROJECT_NAME:?}" --production-branch "$REPO_REF" >/dev/null 2>&1 || true
        node_modules/.bin/wrangler pages deploy dist --project-name "${HARNESS_PROJECT_NAME:?}" --branch "$REPO_REF" --commit-hash "$GITHUB_SHA"
```

Notes for the implementer:
- The deploy step invokes `node_modules/.bin/wrangler` directly instead of the plan's original `bunx wrangler` — a quality-review decision (authorized deviation) so a missing local install fails loudly rather than letting bunx fetch an unpinned wrangler from the registry.
- `SITE_URL` is deliberately absent from the step `env:` — a workflow-level `SITE_URL` override reaches the script through the inherited environment, preserving the documented custom-domain mechanism.
- The `pages project create ... || true` swallow is safe: any real authentication or network failure surfaces in the deploy that immediately follows; only the "already exists" case is tolerated.
- The validation gate and the `HARNESS_PROJECT_NAME` namespacing are Task 4 review fixes (authorized deviations), applied in commit 292d253 after the quality review found the silent no-op on unrecognized targets and the generic `PROJECT_NAME` leaking job-wide through `GITHUB_ENV`.
- `HARNESS_PROJECT_NAME` reaches the deploy step through `GITHUB_ENV` written by the build step; `${HARNESS_PROJECT_NAME:?}` fails loudly if that contract breaks.
- The guard message avoids `${{ }}` expressions so nothing is interpolated by GitHub before bash runs.

- [ ] **Step 2: Sanity-check YAML locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('action.yml')); yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null || bunx yaml action.yml`

Expected: no output / no error. (If neither tool is available, careful visual review of indentation.)

- [ ] **Step 3: Run repo checks**

Run: `bun run check && bun run test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add action.yml
git commit -m "feat: deploy to cloudflare pages when deploy-target is cloudflare"
```

### Task 5: Document the Cloudflare target

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the introduction (line 3)**

Replace:

```markdown
A reusable Starlight application that publishes any repository's `docs/` tree to GitHub Pages with zero JavaScript in the consuming repository.
```

with:

```markdown
A reusable Starlight application that publishes any repository's `docs/` tree to GitHub Pages or Cloudflare Pages with zero JavaScript in the consuming repository.
```

- [ ] **Step 2: Update the inputs table**

Replace the `base` and `repo-ref` rows and append two rows, so the table reads:

```markdown
| `base` | `/<repository-name>` | Site base path. Defaults to `/<repository-name>` for project pages and `/` for Cloudflare Pages. |
| `repo-url` | consumer repository | Repository web URL used to rewrite repo-relative links. |
| `repo-ref` | `main` | Repository ref used to rewrite repo-relative links; with `deploy-target: cloudflare`, also the deployed branch. |
| `deploy-target` | `github-pages` | Deployment target. `github-pages` uploads the Pages artifact; `cloudflare` deploys with wrangler. |
| `project-name` | derived | Cloudflare Pages project name. Defaults to the repository name lowercased with non-alphanumerics collapsed to hyphens. |
```

- [ ] **Step 3: Extend the default-origin paragraph**

After the existing paragraph about the `github.io` origin default (the one mentioning `SITE_URL` overrides and user-pages repositories), append:

```markdown
With `deploy-target: cloudflare` the origin defaults to `https://<project>.pages.dev` and the base path to `/`; a workflow-level `SITE_URL` override points the build at a custom domain, which you then add in the Cloudflare dashboard.
```

- [ ] **Step 4: Scope the artifact-only sentence and add the Cloudflare section**

Replace:

```markdown
The action only uploads the artifact; the consuming workflow deploys it with `actions/deploy-pages` afterwards:
```

with:

```markdown
With the default `github-pages` target the action only uploads the artifact; the consuming workflow deploys it with `actions/deploy-pages` afterwards:
```

Then, after the existing `actions/deploy-pages` example block and before the "Pin the action" closing paragraph, insert:

```markdown
## Deploying to Cloudflare Pages

Set `deploy-target: cloudflare` and expose a Cloudflare API token as environment; the action deploys the built site with wrangler itself, so no deploy job is needed.

```yaml
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: PrimePack-AB/starlight-docs-harness@v1.4
        with:
          repo-url: https://github.com/owner/consumer
          deploy-target: cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

The token needs the Cloudflare Pages `Edit` permission; set `CLOUDFLARE_ACCOUNT_ID` when the token spans multiple accounts.
The Pages project name defaults to the repository name lowercased with non-alphanumeric runs collapsed to hyphens; pass `project-name` to override it.
Deployments carry the `repo-ref` input as their branch: the default `main` deploys to production, and any other branch yields a Pages preview URL that leaves production untouched.
The deploy step creates the project on first use through an idempotent `wrangler pages project create` attempt, so no one-time setup is required.
```

- [ ] **Step 5: Point usage examples at the new version**

Update both `PrimePack-AB/starlight-docs-harness@v1.3` occurrences (the "Usage as an action" example and the deploy example) to `@v1.4`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document the cloudflare pages deployment target"
```

### Task 6: CI validation, manual deploy, release

- [ ] **Step 1: Push the branch and open a PR**

```bash
git push -u origin cloudflare-pages-deploy
gh pr create --title "feat: cloudflare pages deployment target" --body "Implements the design in docs/notes/architecture/2026-10-16-cloudflare-pages-deploy-design.md: an opt-in deploy-target: cloudflare path that builds the same site and deploys it with pinned wrangler. Default github-pages flow unchanged; self-test-cloudflare job asserts the missing-token guard and the root-base build." --draft
gh pr checks --watch
```

Expected: `check`, `self-test`, and `self-test-cloudflare` all pass. Per the CI log verification recipe, use `gh run watch` and download full logs for any failure before analyzing.

- [ ] **Step 2: Manual deploy validation (requires the user's Cloudflare account)**

Mark ready and merge per the repository's usual flow after review; then, on `main`, from a scratch clone (or via a temporary workflow dispatching the action with real secrets against a throwaway project), confirm one real deployment succeeds and the site serves at `https://<project>.pages.dev`. This is the deployability check that replaces the nonexistent `--dry-run` flag. Do not tag before this passes.

- [ ] **Step 3: Tag the release**

```bash
git tag -a v1.4 -m "cloudflare pages deployment target"
git push origin v1.4
```

- [ ] **Step 4: Retire the working notes**

After the release is validated, delete `docs/notes/architecture/2026-10-16-cloudflare-pages-deploy-design.md` and this plan, and update `docs/notes/README.md` — or migrate anything of lasting value into the README first (the notes' content is now fully represented there).

---

## Self-review notes

- Spec coverage: selectable target (Task 4), direct deploy + guard (Task 4), Pages product (Task 4), project-name default (Tasks 2 and 4), per-target derivations (Task 4), wrangler pinning (Task 1), README (Task 5), CI self-test incl. guard and pinned-wrangler assertions (Task 3), manual pre-tag deploy (Task 6). Out-of-scope items from the spec appear nowhere.
- Placeholder scan: none; every step carries exact content. The single conditional (Step 1 of Task 3 choosing the positive vs negative site-URL assertion) is resolved by a defined local inspection, not left open.
- Type consistency: `pagesProjectName(explicit, repository)` signature and `scripts/pages-project-name.mjs` path are identical across Tasks 2 and 4; `deploy-target`/`project-name` input names match across `action.yml`, CI, and README.
