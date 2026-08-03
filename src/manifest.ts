import { FRAME_DURATIONS, PALETTE_INDEX, SHIGURE_PALETTE, SIZE_DIMENSIONS } from "./manifest-data";
import { FINAL_ASSETS_READY, FINAL_MANIFEST } from "./assets/final";
import { generatePlaceholderFrames } from "./placeholder";
import type { AnimationSpec, CharacterManifest, PetSize, PetState } from "./types";

/** Final art is selected when the data module is ready; the placeholder remains a safe fallback. */
export const ASSETS_ARE_PLACEHOLDER = !FINAL_ASSETS_READY;

/** Palette index 0 is transparent; the remaining entries are the 12 handoff tokens. */
export { SHIGURE_PALETTE };
export { generatePlaceholderFrames };

function makeAnimationSpecs(size: PetSize): Record<PetState, AnimationSpec> {
  const makeSpec = (state: PetState): AnimationSpec => ({
    frames: generatePlaceholderFrames(size, state),
    frameDurationMs: FRAME_DURATIONS[state],
    loop: state !== "success" && state !== "error",
  });
  return {
    idle: makeSpec("idle"),
    thinking: makeSpec("thinking"),
    working: makeSpec("working"),
    waiting: makeSpec("waiting"),
    success: makeSpec("success"),
    error: makeSpec("error"),
    retry: makeSpec("retry"),
  };
}

const PLACEHOLDER_MANIFEST: CharacterManifest = {
  id: "shigure",
  displayName: "时雨",
  palette: SHIGURE_PALETTE,
  sizes: {
    regular: makeAnimationSpecs("regular"),
    compact: makeAnimationSpecs("compact"),
  },
};

export const SHIGURE_MANIFEST: CharacterManifest = FINAL_ASSETS_READY ? FINAL_MANIFEST : PLACEHOLDER_MANIFEST;

const REQUIRED_TOKEN_INDICES = [
  ["eye_blue", PALETTE_INDEX.eyeBlue],
  ["ribbon_red", PALETTE_INDEX.ribbonRed],
  ["trim_warm_white", PALETTE_INDEX.trimWarmWhite],
  ["sock_black", PALETTE_INDEX.sockBlack],
] as const;

export function validateManifest(manifest: CharacterManifest): string[] {
  const violations: string[] = [];
  if (manifest.palette[0] !== "transparent") violations.push("palette[0]: transparent index must be 0");

  for (const size of ["regular", "compact"] as const) {
    const sizeManifest = manifest.sizes[size];
    if (!sizeManifest) {
      violations.push(`${size}: missing size manifest`);
      continue;
    }
    for (const state of ["idle", "thinking", "working", "waiting", "success", "error", "retry"] as const) {
      const spec = sizeManifest[state];
      if (!spec) {
        violations.push(`${size}/${state}: missing animation spec`);
        continue;
      }
      if (spec.frames.length === 0) violations.push(`${size}/${state}: requires at least one frame`);
      if (!Number.isFinite(spec.frameDurationMs) || spec.frameDurationMs < 167 || spec.frameDurationMs > 600) {
        violations.push(`${size}/${state}: frameDurationMs ${spec.frameDurationMs} is outside [167, 600]`);
      }
      if (Number.isFinite(spec.frameDurationMs) && 1000 / spec.frameDurationMs > 6) {
        violations.push(`${size}/${state}: effective FPS exceeds 6`);
      }

      const presentTokens = new Set<number>();
      for (const [frameIndex, frame] of spec.frames.entries()) {
        const dimension = SIZE_DIMENSIONS[size];
        if (frame.width !== dimension || frame.height !== dimension) {
          violations.push(`${size}/${state}/frame ${frameIndex}: expected ${dimension}x${dimension}, got ${frame.width}x${frame.height}`);
        }
        if (frame.pixels.length !== frame.width * frame.height) {
          violations.push(`${size}/${state}/frame ${frameIndex}: pixel array length ${frame.pixels.length} does not match ${frame.width}x${frame.height}`);
        }
        let opaquePixels = 0;
        for (const [pixelIndex, paletteIndex] of frame.pixels.entries()) {
          if (paletteIndex >= manifest.palette.length) {
            violations.push(`${size}/${state}/frame ${frameIndex} pixel ${pixelIndex}: palette index ${paletteIndex} is out of range`);
          } else if (paletteIndex !== PALETTE_INDEX.transparent) {
            opaquePixels += 1;
            presentTokens.add(paletteIndex);
          }
        }
        if (opaquePixels === 0) violations.push(`${size}/${state}/frame ${frameIndex}: all pixels are transparent`);

        const width = frame.width;
        const height = frame.height;
        if (width > 0 && height > 0) {
          if (Array.from({ length: width }, (_, x) => frame.pixels[x]).some((index) => index !== 0)) {
            violations.push(`${size}/${state}/frame ${frameIndex}: top edge is not transparent`);
          }
          if (Array.from({ length: height }, (_, y) => frame.pixels[y * width]).some((index) => index !== 0)) {
            violations.push(`${size}/${state}/frame ${frameIndex}: left edge is not transparent`);
          }
          if (Array.from({ length: height }, (_, y) => frame.pixels[y * width + width - 1]).some((index) => index !== 0)) {
            violations.push(`${size}/${state}/frame ${frameIndex}: right edge is not transparent`);
          }
        }
      }
      for (const [token, paletteIndex] of REQUIRED_TOKEN_INDICES) {
        if (!presentTokens.has(paletteIndex)) violations.push(`${size}/${state}: required token ${token} is missing`);
      }
    }
  }
  return violations;
}
