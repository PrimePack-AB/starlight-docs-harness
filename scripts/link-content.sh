#!/usr/bin/env bash
# Symlink each rendered subdirectory of DOCS_DIR into src/content/docs.
# Subdirectories named in EXCLUDE_DIRS (comma-separated) are skipped, which is
# how notes/ stays off the site.
set -euo pipefail
shopt -s nullglob

root="$(cd "$(dirname "$0")/.." && pwd)"
docs_dir="$(cd "${DOCS_DIR:-$root/../karrio-dhl-freight-sweden/docs}" && pwd)"
exclude="${EXCLUDE_DIRS:-notes}"
exclude="$(printf '%s' "$exclude" | tr -d ' \t')"
target="$root/src/content/docs"
mkdir -p "$target"

mounted=""
for entry in "$docs_dir"/*/; do
  name="$(basename "$entry")"
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

# Remove stale symlinks whose source directory is no longer mounted.
for link in "$target"/*; do
  [ -L "$link" ] || continue
  name="$(basename "$link")"
  case "$mounted," in
    *",$name,"*) ;;
    *) rm -f "$link" && printf 'unlinked %s\n' "$name" ;;
  esac
done
