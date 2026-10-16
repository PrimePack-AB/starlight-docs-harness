import { describe, expect, it } from "vitest";
import { deriveTitle } from "../src/derived-title.mjs";

describe("deriveTitle", () => {
  it("uses the first heading verbatim", () => {
    expect(deriveTitle("intro\n\n# Real Title\n\ntext\n# Later\n", "guides/page")).toBe("Real Title");
  });

  it("falls back to the directory name for index entries", () => {
    expect(deriveTitle("body text only", "development/architecture/index")).toBe("Architecture");
  });

  it("falls back to the directory name for readme entries", () => {
    expect(deriveTitle("body text only", "development/traceability/beads-archive/readme")).toBe("Beads archive");
  });

  it("derives a top-level index from its sole segment", () => {
    expect(deriveTitle("body", "reference/index")).toBe("Reference");
  });

  it("sentence-cases the filename slug", () => {
    expect(deriveTitle("body", "guides/verification-layers")).toBe("Verification layers");
  });

  it("returns an empty string when nothing derives", () => {
    expect(deriveTitle("body", "index")).toBe("");
  });

  it("does not capture the next line from a heading without text", () => {
    expect(deriveTitle("# \nSome text", "guides/page")).toBe("Page");
  });

  it("accepts up to three spaces of heading indentation", () => {
    expect(deriveTitle("   # Indented heading\n", "guides/x")).toBe("Indented heading");
  });

  it("returns an empty string for a bare top-level readme", () => {
    expect(deriveTitle("body", "readme")).toBe("");
  });
});
