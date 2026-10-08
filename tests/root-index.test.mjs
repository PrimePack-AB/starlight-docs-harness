import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rootIndex } from "../src/mounts.mjs";
import { rehypeRepoLinks } from "../src/plugins/rehype-repo-links.mjs";

const repoUrl = "https://github.com/PrimePack-AB/karrio-dhl-freight-sweden";
let tmp;
let docsDir;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-root-index-"));
  docsDir = path.join(tmp, "consumer", "docs");
  fs.mkdirSync(path.join(docsDir, "guides"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "notes"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "consumer", "tests"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "guides", "lookups.md"), '---\ntitle: "Lookups"\n---\n');
  fs.writeFileSync(path.join(docsDir, "notes", "findings.md"), '---\ntitle: "Findings"\n---\n');
  fs.writeFileSync(path.join(tmp, "consumer", "tests", "booking.json"), "{}\n");
});

afterEach(() => {
  fs.rmSync(tmp, { force: true, recursive: true });
  vi.restoreAllMocks();
});

const write = (name) => fs.writeFileSync(path.join(docsDir, name), '---\ntitle: "Home"\n---\n');

const transform = (href, file, baseUrl = "/karrio-dhl-freight-sweden") => {
  const messages = [];
  const plugin = rehypeRepoLinks({ docsDir, excludeDirs: ["notes"], baseUrl, repoUrl, repoRef: "main" });
  const tree = { type: "root", children: [{ type: "element", tagName: "a", properties: { href }, children: [] }] };
  plugin(tree, { history: [file], message: (reason) => messages.push(reason) });
  return { href: tree.children[0].properties.href, messages };
};

const fromGuide = (href, baseUrl) => transform(href, path.join(docsDir, "guides", "lookups.md"), baseUrl);

it("reports no root index when the docs directory has none", () => {
  expect(rootIndex(docsDir)).toBeNull();
});

it("detects a root index.md or index.mdx", () => {
  write("index.mdx");
  expect(rootIndex(docsDir)).toBe("index.mdx");
  fs.rmSync(path.join(docsDir, "index.mdx"));
  write("index.md");
  expect(rootIndex(docsDir)).toBe("index.md");
});

it("ignores a directory named index.md", () => {
  fs.mkdirSync(path.join(docsDir, "index.md"));
  expect(rootIndex(docsDir)).toBeNull();
});

it("refuses both index.md and index.mdx", () => {
  write("index.md");
  write("index.mdx");
  expect(() => rootIndex(docsDir)).toThrow(/both index\.md and index\.mdx/);
});

it("keeps rewriting root index links to blob URLs when there is no root index", () => {
  const { href } = fromGuide("../index.md");
  expect(href).toBe(`${repoUrl}/blob/main/docs/index.md`);
});

it("rewrites links to the root index to the site root", () => {
  write("index.md");
  expect(fromGuide("../index.md#top").href).toBe("/karrio-dhl-freight-sweden/#top");
  expect(fromGuide("../index.md", "").href).toBe("/");
});

it("rewrites links to a root index.mdx to the site root", () => {
  write("index.mdx");
  expect(fromGuide("../index.mdx").href).toBe("/karrio-dhl-freight-sweden/");
});

it("rewrites links inside the root index like any other page", () => {
  write("index.md");
  const index = path.join(docsDir, "index.md");
  expect(transform("./guides/lookups.md#usage", index).href).toBe("/karrio-dhl-freight-sweden/guides/lookups/#usage");
  expect(transform("notes/findings.md", index).href).toBe(`${repoUrl}/blob/main/docs/notes/findings.md`);
  expect(transform("../tests/booking.json", index).href).toBe(`${repoUrl}/blob/main/tests/booking.json`);
  expect(transform("./guides", index).href).toBe(`${repoUrl}/tree/main/docs/guides`);
});
