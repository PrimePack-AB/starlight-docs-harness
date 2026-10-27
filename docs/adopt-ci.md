# Adopt docs CI (paste prompt)

Adoption is a paste: open an LLM coding session in the consuming repository, fill the two parameters below, and paste everything between the paste markers.
The session writes the workflow, verifies the build locally, and stops before anything irreversible.

Parameters:

- `SITE` — the site hostname with scheme, for example `https://docs.example.com`.
- `EXCLUDE` — comma-separated `docs/` subdirectories to keep private, for example `notes,plans`.

---- paste from here ----

You are setting up documentation CI for this repository using the
starlight-docs-harness composite action
(`PrimePack-AB/starlight-docs-harness@v1.5`). Work through the steps in
order and honor the hard stops.

1. Read `docs/` and list its subdirectories. At least one subdirectory
   must remain outside `EXCLUDE`, or the site build fails with "no
   mountable docs directories"; if none remains, stop and report what
   you found rather than inventing content. Check for a root
   `docs/index.md` or `docs/index.mdx`; if absent, note that the
   bundled landing page is used until one is authored.
2. Create `.github/workflows/docs.yml` with exactly this shape, with
   `SITE` substituted into `SITE_URL` and `EXCLUDE` into `exclude`:

   ```yaml
   name: docs
   on:
     push:
       branches: [main]
       paths: ["docs/**", ".github/workflows/docs.yml"]
     workflow_dispatch:
   concurrency:
     group: docs
     cancel-in-progress: true
   env:
     SITE_URL: SITE
   jobs:
     docs:
       runs-on: ubuntu-latest
       permissions:
         contents: read
       steps:
         - uses: actions/checkout@v4
         - uses: PrimePack-AB/starlight-docs-harness@v1.5
           with:
             deploy-target: cloudflare
             exclude: EXCLUDE
           env:
             CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
   ```

3. Verify locally before committing: clone the harness at the pinned
   tag into a scratch directory, install, and build against this
   repository's `docs/`:

   Run this from the consuming repository's root; it captures what it
   needs before descending into the scratch clone. The local build must
   exclude the same directories CI excludes:

   ```bash
   REPO_ROOT="$PWD"
   REPO_URL="$(git remote get-url origin | sed 's#git@github.com:#https://github.com/#')"
   SCRATCH=$(mktemp -d)
   git clone --depth 1 --branch v1.5 \
     https://github.com/PrimePack-AB/starlight-docs-harness "$SCRATCH/h"
   cd "$SCRATCH/h" && bun install --frozen-lockfile
   DOCS_DIR="$REPO_ROOT/docs" EXCLUDE_DIRS=EXCLUDE SITE_URL=SITE SITE_BASE=/ \
     REPO_URL="$REPO_URL" bun run build
   ```

   `EXCLUDE_DIRS` carries the workflow's `exclude` input into the local
   build; without it, local verification renders the private
   directories that CI excludes, so the two builds diverge silently.

   Confirm `dist/` renders the mounted sections and contains nothing
   from `EXCLUDE`. Install bun from https://bun.sh if it is absent.
4. Commit the workflow on a working branch. Do not push.
5. Report back, in this order:
   - the workflow YAML;
   - the local build outcome;
   - the human command for the token secret:
     `gh secret set CLOUDFLARE_API_TOKEN` with a token scoped to
     Cloudflare Pages Edit, plus `CLOUDFLARE_ACCOUNT_ID` only when the
     token spans accounts;
   - the one dashboard step after the first green run: attach the
     custom domain to the newly created Pages project (Workers & Pages
     → project → Custom domains); DNS and certificates are automatic
     when the domain's zone is on the same account;
   - the caveat that the first deployment creates the project with the
     `repo-ref` branch (`main` by default) as its production branch, so
     the first run must come from `main`, never a feature branch.
6. Hard stops: never push; never create or modify secrets; never
   change `repo-ref` from `main`. If any step finds friction in the
   harness itself — undocumented behavior, a wrong example, a missing
   step — report it verbatim so it becomes a harness amendment.

---- paste to here ----
