import { describe, expect, it } from "vitest";
import {
  ASSETS_ARE_PLACEHOLDER,
  SHIGURE_MANIFEST,
  generatePlaceholderFrames,
  validateManifest,
} from "./manifest";
import { FINAL_ASSETS_READY } from "./assets/final";
import type { PetSize, PetState } from "./types";

const sizes = ["regular", "compact"] as const satisfies readonly PetSize[];
const states = ["idle", "thinking", "working", "waiting", "success", "error", "retry"] as const satisfies readonly PetState[];

describe("Shigure manifest", () => {
  it("generates identical placeholder frames for identical inputs", () => {
    const first = generatePlaceholderFrames("regular", "idle");
    const second = generatePlaceholderFrames("regular", "idle");

    expect(first).toEqual(second);
    expect(FINAL_ASSETS_READY).toBe(true);
    expect(ASSETS_ARE_PLACEHOLDER).toBe(false);
  });

  it("contains exact frame dimensions and pixel lengths for every size and state", () => {
    for (const size of sizes) {
      const expectedDimension = size === "regular" ? 24 : 16;
      for (const state of states) {
        const spec = SHIGURE_MANIFEST.sizes[size][state];
        expect(spec.frames.length).toBe(["idle", "thinking", "working", "waiting", "retry"].includes(state) ? 2 : 1);
        for (const frame of spec.frames) {
          expect(frame.width).toBe(expectedDimension);
          expect(frame.height).toBe(expectedDimension);
          expect(frame.pixels.length).toBe(expectedDimension * expectedDimension);
        }
      }
    }
  });

  it("rejects a manifest with a missing state", () => {
    const broken = structuredClone(SHIGURE_MANIFEST);
    Object.defineProperty(broken.sizes.regular, "idle", { value: undefined });

    expect(validateManifest(broken)).toContain("regular/idle: missing animation spec");
  });

  it("rejects a manifest with an incorrect logical size", () => {
    const broken = structuredClone(SHIGURE_MANIFEST);
    const frame = broken.sizes.compact.idle.frames[0];
    if (!frame) throw new Error("test fixture must contain a frame");
    frame.width = 24;

    expect(validateManifest(broken)).toContain("compact/idle/frame 0: expected 16x16, got 24x16");
  });

  it("rejects a manifest with an illegal palette index", () => {
    const broken = structuredClone(SHIGURE_MANIFEST);
    const frame = broken.sizes.regular.idle.frames[0];
    if (!frame) throw new Error("test fixture must contain a frame");
    frame.pixels[0] = 255;

    expect(validateManifest(broken)).toContain("regular/idle/frame 0 pixel 0: palette index 255 is out of range");
  });

  it("rejects a fully transparent state", () => {
    const broken = structuredClone(SHIGURE_MANIFEST);
    const frame = broken.sizes.compact.error.frames[0];
    if (!frame) throw new Error("test fixture must contain a frame");
    frame.pixels.fill(0);

    expect(validateManifest(broken)).toContain("compact/error/frame 0: all pixels are transparent");
  });
});
