---
title: "Cloudflare Pages deployment: design"
created: 2026-10-16
---

## Motivation

The harness currently publishes to GitHub Pages only: the composite action builds the Starlight site, uploads a `github-pages` artifact, and the consuming workflow deploys it with `actions/deploy-pages`.
Consumers hosted on Cloudflare want the same zero-boilerplate experience — plain markdown in `docs/`, no JavaScript or infrastructure in the consuming repository — with the site served from Cloudflare's edge.

## Decisions

Three structural questions were settled during brainstorming.

Deployment target is a selectable input, not a replacement.
A `deploy-target` input defaults to `github-pages`, so existing consumers keep working unchanged and Cloudflare is opt-in per workflow.
This avoids a breaking major version for a capability that only some consumers need.

The action deploys directly.
With `deploy-target: cloudflare`, the action itself runs `wrangler pages deploy` after the build.
Wrangler authenticates from environment variables (`CLOUDFLARE_API_TOKEN`, optionally `CLOUDFLARE_ACCOUNT_ID`), so the consumer adds secrets as job environment and nothing else — no `deploy-pages`-style second job, no download-artifact boilerplate.
This matches the harness philosophy of zero setup in the consuming repository.

The product is Cloudflare Pages.
`wrangler pages deploy dist --project-name=<name>` needs no config file, which keeps the harness free of a wrangler.jsonc that would exist only to name an output directory.
Pages remains fully supported for static sites even though Cloudflare's active development has shifted to Workers static assets; the choice can be revisited if a worker script (redirects, access control) ever becomes necessary.

## Design

### Inputs

`deploy-target` accepts `github-pages` (default) or `cloudflare`.
`project-name` names the Pages project and defaults to the repository name lowercased with non-alphanumeric characters collapsed to hyphens, since Pages project names allow lowercase letters, digits, and hyphens.

### Default derivations

The build step's shell derives `SITE_URL` and `SITE_BASE` per target when the workflow did not set them.
For `github-pages` the existing defaults are unchanged: `https://<owner>.github.io` and `/<repo>`.
For `cloudflare` the defaults become `https://<project>.pages.dev` and `/`, because a Pages project serves from the site root and the project-pages `/<repo>` prefix would produce broken canonical URLs.
Explicit `base` input and `SITE_URL` environment overrides keep precedence in both modes; overriding both is also how a consumer points the build at a custom domain.

### Deploy steps

The `upload-pages-artifact` step runs only for `github-pages`.
A new step runs for `cloudflare`: it fails fast with an actionable message when `CLOUDFLARE_API_TOKEN` is unset, then runs `bunx wrangler pages deploy dist --project-name=<name> --branch=<repo-ref>` from the harness directory.
Passing `--branch` explicitly — defaulting to `main` through the existing `repo-ref` input — makes production deploys deterministic, and a deployment from any other branch produces a Pages preview URL rather than touching production.

Wrangler ships as a harness devDependency, so the existing `bun install --frozen-lockfile` step pins its version through `bun.lock`.
This mirrors the repository's SHA-pinned action hygiene and gives consumers reproducible deploys.

The first deploy to a new project is expected to auto-create the Pages project non-interactively.
If verification shows otherwise, the README documents `wrangler pages project create <name> --production-branch=main` as the one-time setup command.

### Documentation

The README gains a "Deploying to Cloudflare Pages" section with the consumer workflow example, the two new input-table rows, the changed default derivations, custom-domain guidance, and the branch-to-preview behavior.

## Verification

CI extends the `self-test` job with a Cloudflare-mode pass that runs the action with `deploy-target: cloudflare` and asserts the built HTML carries the `pages.dev` canonical URL and root base path.
A `bunx wrangler pages deploy dist --dry-run` invocation (no credentials required) proves the pinned wrangler resolves and `dist` is deployable.
One manual deployment to a scratch Pages project validates the real path before tagging the release as `v1.4`.

## Out of scope

Preview-deployment workflows beyond the free `--branch` behavior, Workers static assets, and secret-valued action inputs are deliberately excluded.
