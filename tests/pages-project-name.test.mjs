import { describe, expect, it } from "vitest";
import { pagesProjectName } from "../scripts/pages-project-name.mjs";

describe("pagesProjectName", () => {
  it("uses the explicit project name", () => {
    expect(pagesProjectName("custom-name", "owner/Some_Repo")).toBe("custom-name");
  });

  it("normalizes the explicit project name like a derived one", () => {
    expect(pagesProjectName("My_Repo", "owner/repo")).toBe("my-repo");
  });

  it("derives from the repository name segment", () => {
    expect(pagesProjectName("", "PrimePack-AB/starlight-docs-harness")).toBe("starlight-docs-harness");
  });

  it("derives from a bare repository name without owner", () => {
    expect(pagesProjectName("", "starlight-docs-harness")).toBe("starlight-docs-harness");
  });

  it("lowercases and collapses non-alphanumerics into hyphens", () => {
    expect(pagesProjectName("", "owner/My_Cool.Repo")).toBe("my-cool-repo");
  });

  it("trims leading and trailing hyphens", () => {
    expect(pagesProjectName("", "owner/__repo__")).toBe("repo");
  });

  it("returns an empty string when nothing derives", () => {
    expect(pagesProjectName("", "owner/___")).toBe("");
  });
});
