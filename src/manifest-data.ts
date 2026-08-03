import type { PetSize, PetState } from "./types";

export const SHIGURE_PALETTE = [
  "transparent",
  "#2A1D1A",
  "#4A2B24",
  "#704739",
  "#FFD0B4",
  "#4BA9FF",
  "#153A78",
  "#242634",
  "#F1E8DF",
  "#C52F3C",
  "#141820",
  "#4B2624",
  "#17141B",
] as const;

export const PALETTE_INDEX = {
  transparent: 0,
  hairShadow: 1,
  hairBase: 2,
  hairLight: 3,
  skin: 4,
  eyeBlue: 5,
  eyeDeep: 6,
  uniform: 7,
  trimWarmWhite: 8,
  ribbonRed: 9,
  sockBlack: 10,
  bootRedBrown: 11,
  outline: 12,
} as const;

export const SIZE_DIMENSIONS: Record<PetSize, 24 | 16> = { regular: 24, compact: 16 };
export const FRAME_COUNTS: Record<PetState, 1 | 2> = {
  idle: 2,
  thinking: 2,
  working: 2,
  waiting: 2,
  success: 1,
  error: 1,
  retry: 2,
};
export const FRAME_DURATIONS: Record<PetState, number> = {
  idle: 400,
  thinking: 200,
  working: 200,
  waiting: 300,
  success: 300,
  error: 300,
  retry: 200,
};
