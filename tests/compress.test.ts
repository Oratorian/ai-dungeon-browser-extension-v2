import { describe, it, expect } from "vitest";
import { isInlineImage, formatBytes } from "@/media/compress";

// compressInlineImage itself needs a canvas and is exercised in the browser. What can be pinned
// down here is the decision it is built on: which images are even candidates.

describe("isInlineImage", () => {
  it("is true only for data URIs", () => {
    expect(isInlineImage("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isInlineImage("data:image/webp;base64,UklGR")).toBe(true);
  });

  it("is false for anything stored as a link, which costs nothing and must never be inlined", () => {
    expect(isInlineImage("https://trinetra.mahesvara.cloud/i/9fSO19PJJtAW")).toBe(false);
    expect(isInlineImage("http://example.com/x.png")).toBe(false);
    expect(isInlineImage("")).toBe(false);
  });

  it("tolerates non-string input rather than throwing on a corrupt card", () => {
    expect(isInlineImage(undefined as unknown as string)).toBe(false);
    expect(isInlineImage(null as unknown as string)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("picks the unit by size", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("rounds kilobytes and keeps one decimal for megabytes", () => {
    expect(formatBytes(1536)).toBe("2 KB");
    expect(formatBytes(110.84 * 1024 * 1024)).toBe("110.8 MB");
  });
});
