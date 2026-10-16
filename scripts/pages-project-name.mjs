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
