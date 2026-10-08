import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { rehypeRepoLinks } from "../src/plugins/rehype-repo-links.mjs";

let tmp;
let docsDir;
let mounts;

const anchor = (href) => ({
  type: "element",
  tagName: "a",
  properties: { href },
  children: [{ type: "text", value: "link" }],
});

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  docsDir = path.join(tmp, "consumer", "docs");
  mounts = path.join(tmp, "src", "content", "docs");
  fs.mkdirSync(mounts, { recursive: true });
  fs.mkdirSync(path.join(docsDir, "concepts"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "guides"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "development"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "notes", "sandbox"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "consumer", "tests", "fixtures"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "concepts", "products.md"), '---\ntitle: "Products"\n---\n');
  fs.writeFileSync(path.join(docsDir, "concepts", "api-index.md"), '---\ntitle: "API index"\n---\n');
  fs.writeFileSync(path.join(docsDir, "concepts", "my file.md"), '---\ntitle: "My file"\n---\n');
  fs.writeFileSync(path.join(docsDir, "development", "index.md"), '---\ntitle: "Development"\n---\n');
  fs.writeFileSync(path.join(docsDir, "guides", "lookups.md"), '---\ntitle: "Lookups"\n---\n');
  fs.writeFileSync(path.join(docsDir, "notes", "sandbox", "findings.md"), '---\ntitle: "Findings"\n---\n');
  fs.writeFileSync(path.join(tmp, "consumer", "tests", "fixtures", "booking.json"), "{}\n");
  fs.symlinkSync(path.join(docsDir, "concepts"), path.join(mounts, "concepts"), "dir");
  fs.symlinkSync(path.join(docsDir, "guides"), path.join(mounts, "guides"), "dir");
});

afterAll(() => {
  fs.rmSync(tmp, { force: true, recursive: true });
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const transform = (href, file = path.join(mounts, "guides", "lookups.md")) => {
  const messages = [];
  const plugin = rehypeRepoLinks({
    docsDir,
    excludeDirs: ["notes"],
    baseUrl: "/karrio-dhl-freight-sweden",
    repoUrl: "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden",
    repoRef: "main",
  });
  const tree = { type: "root", children: [anchor(href)] };
  plugin(tree, { history: [file], message: (reason) => messages.push(reason) });
  return { href: tree.children[0].properties.href, messages };
};

const apply = (href, file) => transform(href, file).href;

it("rewrites relative markdown links inside mounted directories to site routes", () => {
  expect(apply("../concepts/products.md#the-eu-vat-area")).toBe(
    "/karrio-dhl-freight-sweden/concepts/products/#the-eu-vat-area",
  );
});

it("rewrites markdown links into excluded directories to blob URLs without warnings", () => {
  const { href, messages } = transform("../notes/sandbox/findings.md");
  expect(href).toBe(
    "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden/blob/main/docs/notes/sandbox/findings.md",
  );
  expect(messages).toEqual([]);
});

it("rewrites repo-relative non-content links to blob URLs", () => {
  expect(apply("../../tests/fixtures/booking.json")).toBe(
    "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden/blob/main/tests/fixtures/booking.json",
  );
});

it("leaves absolute, fragment-only, and mailto links untouched", () => {
  expect(apply("https://example.com/x.md")).toBe("https://example.com/x.md");
  expect(apply("#anchor")).toBe("#anchor");
  expect(apply("mailto:someone@example.org")).toBe("mailto:someone@example.org");
});

it("leaves scheme URIs without an authority untouched", () => {
  expect(apply("tel:+46701234567")).toBe("tel:+46701234567");
  expect(apply("MAILTO:someone@example.org")).toBe("MAILTO:someone@example.org");
});

it("leaves empty and dot-only hrefs untouched", () => {
  expect(apply("")).toBe("");
  expect(apply(".")).toBe(".");
  expect(apply("./")).toBe("./");
});

it("leaves links with malformed percent-encoding untouched, with a warning", () => {
  const { href, messages } = transform("100%.md");
  expect(href).toBe("100%.md");
  expect(messages).toEqual(["cannot decode percent-encoding in link target: 100%.md"]);
});

it("keeps an api-index basename in the route", () => {
  expect(apply("../concepts/api-index.md")).toBe("/karrio-dhl-freight-sweden/concepts/api-index/");
});

it("rewrites index pages to their section-root route", () => {
  expect(apply("../development/index.md")).toBe("/karrio-dhl-freight-sweden/development/");
});

it("decodes and slugifies percent-encoded targets to route slugs", () => {
  expect(apply("../concepts/my%20file.md")).toBe("/karrio-dhl-freight-sweden/concepts/my-file/");
});

it("rewrites directory links to tree URLs", () => {
  expect(apply("../concepts")).toBe(
    "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden/tree/main/docs/concepts",
  );
});

it("warns when a mounted docs target does not exist", () => {
  const { href, messages } = transform("../concepts/ghost.md");
  expect(href).toBe("/karrio-dhl-freight-sweden/concepts/ghost/");
  expect(messages).toEqual(["mounted docs link target does not exist: concepts/ghost.md"]);
  expect(console.warn).toHaveBeenCalledWith(
    "[rehype-repo-links] mounted docs link target does not exist: concepts/ghost.md",
  );
});

it("warns when a repository target does not exist", () => {
  const { href, messages } = transform("../../tests/fixtures/ghost.json");
  expect(href).toBe("https://github.com/PrimePack-AB/karrio-dhl-freight-sweden/blob/main/tests/fixtures/ghost.json");
  expect(messages).toEqual(["repository link target does not exist: tests/fixtures/ghost.json"]);
});

it("warns and leaves the href when a target is outside the repository", () => {
  const { href, messages } = transform("../../../outside.md");
  expect(href).toBe("../../../outside.md");
  expect(messages).toEqual(["link target is outside the repository: ../../../outside.md"]);
});
