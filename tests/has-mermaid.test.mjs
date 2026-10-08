import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { hasMermaid } from "../src/mounts.mjs";

const diagram = "# Flow\n\n```mermaid\nflowchart LR\n  a --> b\n```\n";
let docsDir;

beforeEach(() => {
  docsDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mermaid-"));
  fs.mkdirSync(path.join(docsDir, "guides", "nested"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "notes"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "guides", "plain.md"), "# Plain\n\n```bash\necho mermaid\n```\n");
});

afterEach(() => {
  fs.rmSync(docsDir, { force: true, recursive: true });
});

const write = (name, content) => fs.writeFileSync(path.join(docsDir, name), content);

it("finds a mermaid fence in a nested mounted page", () => {
  write("guides/nested/flow.mdx", diagram);
  expect(hasMermaid(docsDir, ["notes"])).toBe(true);
});

it("reports no mermaid when no page has a mermaid fence", () => {
  write("guides/mention.md", "Mermaid diagrams use `mermaid` fences, as in ```mermaid inline.\n");
  expect(hasMermaid(docsDir, ["notes"])).toBe(false);
});

it("ignores mermaid fences that only appear in excluded directories", () => {
  write("notes/flow.md", diagram);
  expect(hasMermaid(docsDir, ["notes"])).toBe(false);
});

it("ignores mermaid fences in unmounted top-level files and non-markdown files", () => {
  write("README.md", diagram);
  write("guides/flow.txt", diagram);
  expect(hasMermaid(docsDir, ["notes"])).toBe(false);
});

it("finds a mermaid fence in the root index", () => {
  write("index.mdx", `---\ntitle: "Home"\n---\n\n${diagram}`);
  expect(hasMermaid(docsDir, ["notes"])).toBe(true);
});

it("accepts tilde fences and longer backtick fences", () => {
  write("guides/tilde.md", "~~~mermaid\nflowchart LR\n~~~\n");
  expect(hasMermaid(docsDir, ["notes"])).toBe(true);
  fs.rmSync(path.join(docsDir, "guides", "tilde.md"));
  write("guides/long.md", "````mermaid\nflowchart LR\n````\n");
  expect(hasMermaid(docsDir, ["notes"])).toBe(true);
});
