# starlight-docs-harness

A reusable Starlight application that publishes any repository's `docs/` tree to GitHub Pages with zero JavaScript in the consuming repository.
The consumer keeps writing plain markdown in `docs/`; the harness supplies the site shell, the build, and the Pages artifact.

## How content mounts

At build time each rendered subdirectory of the consumer's `docs/` directory is symlinked into `src/content/docs/`, so every subdirectory becomes a sidebar section.
Subdirectories named in `EXCLUDE_DIRS` (default `notes`) are not linked and do not render.

The site root renders the consumer's `docs/index.md` or `docs/index.mdx` when one exists, with the same link rewriting and frontmatter handling as every other page.
Without one, the harness's bundled landing page renders instead; having both `index.md` and `index.mdx` fails the build.
Other files at the top level of `docs/` are not mounted.

Starlight's landing-page frontmatter works in the root index:

```markdown
---
title: Consumer docs
template: splash
hero:
  tagline: What this project does, in one line.
  image:
    file: ./guides/logo.svg
  actions:
    - text: Get started
      link: /consumer/guides/getting-started/
---
```

Hero `actions` links are used verbatim rather than rewritten, so write them as site routes including the base path, or as absolute URLs.
A hero `image.file` path resolves against the mounted tree, so the image must sit in a mounted subdirectory; a subdirectory holding only images still appears as a sidebar section.

## How links rewrite

Relative markdown links between mounted pages become site routes, so a `[guide](../guides/guide.md)` reference renders as a normal site URL under the base path.
A link to the root index, such as `[home](../index.md)`, becomes the site root when the root index is mounted.
Links to files outside the rendered tree, such as fixtures, excluded notes, and source code, become absolute GitHub `blob` or `tree` URLs built from `REPO_URL` and `REPO_REF` (default `main`).

## Local preview

Clone the harness, install once, and point it at any consumer's docs directory:

```bash
git clone https://github.com/PrimePack-AB/starlight-docs-harness
cd starlight-docs-harness
bun install
DOCS_DIR=/absolute/path/to/consumer/docs \
SITE_TITLE=consumer \
SITE_BASE=/consumer \
REPO_URL=https://github.com/owner/consumer \
bun run dev
```

## Usage as an action

Add the composite action to a workflow that has the consumer repository checked out; it builds the site and uploads the `github-pages` artifact.

```yaml
- uses: PrimePack-AB/starlight-docs-harness@v1.1
  with:
    repo-url: https://github.com/owner/consumer
```

| Input | Default | Description |
| --- | --- | --- |
| `docs-dir` | `docs` | Docs directory relative to the repository root. |
| `exclude` | `notes` | Comma-separated docs subdirectories excluded from the site. |
| `title` | repository name | Site title. |
| `base` | `/<repository-name>` | Site base path for project pages. |
| `repo-url` | consumer repository | Repository web URL used to rewrite repo-relative links. |
| `repo-ref` | `main` | Repository ref used to rewrite repo-relative links. |

The site origin defaults to `https://<owner>.github.io`, derived from the repository owner, so canonical URLs carry the owner's letter case (`https://PrimePack-AB.github.io`); hosts are case-insensitive at the DNS level.
Set a workflow-level `SITE_URL` environment variable to override the origin, for example for a custom domain.

User-pages repositories (`<owner>.github.io`) serve from the site root and must pass `base: /` instead of relying on the derived default.

The action only uploads the artifact; the consuming workflow deploys it with `actions/deploy-pages` afterwards:

```yaml
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: PrimePack-AB/starlight-docs-harness@v1.1
        with:
          repo-url: https://github.com/owner/consumer
  deploy:
    needs: docs
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Pin the action by commit SHA in the `uses:` line if immutability matters to you; published tags are never force-moved, but a SHA pin removes even that assumption.
