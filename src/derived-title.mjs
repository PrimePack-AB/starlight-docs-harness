/**
 * Derives a page title from the markdown body and the content-collection id.
 * An empty return means nothing derived; the caller leaves the entry untouched.
 */
export function deriveTitle(body, id) {
  const heading = body.match(/^[ \t]{0,3}#[ \t]+(.+?)[ \t]*$/m);
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
