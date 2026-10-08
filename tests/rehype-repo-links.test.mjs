import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
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
  fs.mkdirSync(path.join(docsDir, "notes", "sandbox"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "consumer", "tests", "fixtures"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "concepts", "products.md"), '---\ntitle: "Products"\n---\n');
  fs.writeFileSync(path.join(docsDir, "guides", "lookups.md"), '---\ntitle: "Lookups"\n---\n');
  fs.writeFileSync(path.join(docsDir, "notes", "sandbox", "findings.md"), '---\ntitle: "Findings"\n---\n');
  fs.writeFileSync(path.join(tmp, "consumer", "tests", "fixtures", "booking.json"), "{}\n");
  fs.symlinkSync(path.join(docsDir, "concepts"), path.join(mounts, "concepts"), "dir");
  fs.symlinkSync(path.join(docsDir, "guides"), path.join(mounts, "guides"), "dir");
});

afterAll(() => {
  fs.rmSync(tmp, { force: true, recursive: true });
});

const apply = (href, file = path.join(mounts, "guides", "lookups.md")) => {
  const plugin = rehypeRepoLinks({
    docsDir,
    excludeDirs: ["notes"],
    baseUrl: "/karrio-dhl-freight-sweden",
    repoUrl: "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden",
    repoRef: "main",
  });
  const tree = { type: "root", children: [anchor(href)] };
  plugin(tree, { history: [file] });
  return tree.children[0].properties.href;
};

it("rewrites relative markdown links inside mounted directories to site routes", () => {
  expect(apply("../concepts/products.md#the-eu-vat-area")).toBe(
    "/karrio-dhl-freight-sweden/concepts/products/#the-eu-vat-area",
  );
});

it("rewrites markdown links into excluded directories to blob URLs", () => {
  expect(apply("../notes/sandbox/findings.md")).toBe(
    "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden/blob/main/docs/notes/sandbox/findings.md",
  );
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
