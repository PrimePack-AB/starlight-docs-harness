# starlight-docs-harness

A reusable Starlight application that publishes any repository's `docs/` tree to GitHub Pages with zero JavaScript in the consuming repository.
The consumer keeps writing plain markdown in `docs/`; the harness supplies the site shell, the build, and the Pages artifact.

## How content mounts

At build time each rendered subdirectory of the consumer's `docs/` directory is symlinked into `src/content/docs/`, so every subdirectory becomes a sidebar section.
Subdirectories named in `EXCLUDE_DIRS` (default `notes`) are not linked and do not render.

## How links rewrite

Relative markdown links between mounted pages become site routes, so a `[guide](../guides/guide.md)` reference renders as a normal site URL under the base path.
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
- uses: PrimePack-AB/starlight-docs-harness@v1
  with:
    repo-url: https://github.com/owner/consumer
```

| Input | Default | Description |
| --- | --- | --- |
| `docs-dir` | `docs` | Docs directory relative to the repository root. |
| `exclude` | `notes` | Comma-separated docs subdirectories excluded from the site. |
| `title` | repository name | Site title. |
| `base` | `/<repository-name>` | Site base path for project pages. |
| `repo-url` | empty | Repository web URL used to rewrite repo-relative links. |
| `repo-ref` | `main` | Repository ref used to rewrite repo-relative links. |

The action only uploads the artifact; the consuming workflow deploys it with `actions/deploy-pages` afterwards:

```yaml
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: PrimePack-AB/starlight-docs-harness@v1
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
