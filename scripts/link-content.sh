#!/usr/bin/env bash
# Symlink each rendered subdirectory of DOCS_DIR into src/content/docs.
# Subdirectories named in EXCLUDE_DIRS (comma-separated) are skipped, which is
# how notes/ stays off the site.
# The reserved files/ subdirectory is symlinked into public/ instead, so its
# contents ship verbatim at /files/ without rendering.
# The landing page is DOCS_DIR/index.md or DOCS_DIR/index.mdx when present,
# otherwise the bundled src/default-index.md.
set -euo pipefail
shopt -s nullglob

root="$(cd "$(dirname "$0")/.." && pwd)"
docs_dir="$(cd "${DOCS_DIR:-$root/../karrio-dhl-freight-sweden/docs}" && pwd)"
exclude="${EXCLUDE_DIRS:-notes}"
exclude="$(printf '%s' "$exclude" | tr -d ' \t')"
target="$root/src/content/docs"
mkdir -p "$target"

case ",$exclude," in
  *,files,*)
    printf 'files is a reserved name and cannot appear in EXCLUDE_DIRS\n' >&2
    exit 1
    ;;
esac

mounted=""
for entry in "$docs_dir"/*/; do
  name="$(basename "$entry")"
  [ "$name" = "files" ] && continue
  case ",$exclude," in
    *",$name,"*) continue ;;
  esac
  if [ -e "$target/$name" ] && [ ! -L "$target/$name" ]; then
    printf 'refusing to shadow non-symlink %s\n' "$target/$name" >&2
    exit 1
  fi
  mounted="$mounted,$name"
  ln -sfn "$docs_dir/$name" "$target/$name"
  printf 'linked %s -> %s\n' "$name" "$docs_dir/$name"
done

if [ -d "$docs_dir/files" ]; then
  if [ -e "$root/public/files" ] && [ ! -L "$root/public/files" ]; then
    printf 'refusing to shadow non-symlink %s\n' "$root/public/files" >&2
    exit 1
  fi
  ln -sfn "$docs_dir/files" "$root/public/files"
  printf 'linked files -> %s\n' "$docs_dir/files"
elif [ -L "$root/public/files" ]; then
  rm -f "$root/public/files"
  printf 'unlinked files\n'
fi

index_name=""
for candidate in index.md index.mdx; do
  [ -f "$docs_dir/$candidate" ] || continue
  if [ -n "$index_name" ]; then
    printf '%s has both index.md and index.mdx; keep one root index\n' "$docs_dir" >&2
    exit 1
  fi
  index_name="$candidate"
done
if [ -n "$index_name" ]; then
  index_source="$docs_dir/$index_name"
else
  index_name="index.md"
  index_source="$root/src/default-index.md"
fi
if [ -e "$target/$index_name" ] && [ ! -L "$target/$index_name" ]; then
  printf 'refusing to shadow non-symlink %s\n' "$target/$index_name" >&2
  exit 1
fi
mounted="$mounted,$index_name"
ln -sfn "$index_source" "$target/$index_name"
printf 'linked %s -> %s\n' "$index_name" "$index_source"

# Remove stale symlinks whose source is no longer mounted.
for link in "$target"/*; do
  [ -L "$link" ] || continue
  name="$(basename "$link")"
  case "$mounted," in
    *",$name,"*) ;;
    *) rm -f "$link" && printf 'unlinked %s\n' "$name" ;;
  esac
done
