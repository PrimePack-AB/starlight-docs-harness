import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { mountedDirs } from "../src/mounts.mjs";

let docsDir;

beforeEach(() => {
  docsDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mounted-dirs-"));
});

afterEach(() => {
  fs.rmSync(docsDir, { force: true, recursive: true });
});

it("lists subdirectories sorted, without dotfiles or excluded directories", () => {
  for (const name of ["guides", "concepts", "notes", ".astro"]) {
    fs.mkdirSync(path.join(docsDir, name));
  }
  expect(mountedDirs(docsDir, ["notes"])).toEqual(["concepts", "guides"]);
});

it("never mounts the reserved files directory, whatever the exclude list", () => {
  for (const name of ["guides", "files"]) {
    fs.mkdirSync(path.join(docsDir, name));
  }
  expect(mountedDirs(docsDir, [])).toEqual(["guides"]);
  expect(mountedDirs(docsDir, ["files"])).toEqual(["guides"]);
});

it("ignores top-level entries that are not directories", () => {
  fs.mkdirSync(path.join(docsDir, "guides"));
  fs.writeFileSync(path.join(docsDir, "README.md"), "# Readme\n");
  expect(mountedDirs(docsDir, ["notes"])).toEqual(["guides"]);
});
