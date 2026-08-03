import { FRAME_COUNTS, PALETTE_INDEX, SIZE_DIMENSIONS } from "./manifest-data";
import type { PetSize, PetState, PixelFrame } from "./types";

type Rectangle = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
};

type Canvas = {
  readonly width: number;
  readonly pixels: Uint8Array;
  fill(rectangle: Rectangle): void;
  pixel(x: number, y: number, color: number): void;
};

function makeCanvas(width: number): Canvas {
  const pixels = new Uint8Array(width * width);
  return {
    width,
    pixels,
    fill({ x, y, width: rectangleWidth, height, color }) {
      for (let row = y; row < y + height; row += 1) {
        for (let column = x; column < x + rectangleWidth; column += 1) {
          pixels[row * width + column] = color;
        }
      }
    },
    pixel(x, y, color) {
      pixels[y * width + x] = color;
    },
  };
}

type Pose = {
  readonly shiftX: number;
  readonly headDx: number;
  readonly headDy: number;
  readonly bodyDx: number;
  readonly bodyDy: number;
  readonly eyeDy: number;
  readonly legsDy: number;
  readonly blink: boolean;
  readonly fringeDx: number;
};

const POSES: Record<PetState, readonly Pose[]> = {
  idle: [
    { shiftX: 0, headDx: 0, headDy: 0, bodyDx: 0, bodyDy: 0, eyeDy: 0, legsDy: 0, blink: false, fringeDx: 0 },
    { shiftX: 0, headDx: 0, headDy: 0, bodyDx: 0, bodyDy: 0, eyeDy: 0, legsDy: 0, blink: true, fringeDx: 1 },
  ],
  thinking: [
    { shiftX: 0, headDx: 1, headDy: -1, bodyDx: 0, bodyDy: 0, eyeDy: -1, legsDy: 0, blink: false, fringeDx: 0 },
    { shiftX: 0, headDx: 1, headDy: -1, bodyDx: 0, bodyDy: 0, eyeDy: -1, legsDy: 0, blink: true, fringeDx: 0 },
  ],
  working: [
    { shiftX: 0, headDx: 1, headDy: 0, bodyDx: 1, bodyDy: 1, eyeDy: 1, legsDy: 0, blink: false, fringeDx: 0 },
    { shiftX: 0, headDx: 1, headDy: 0, bodyDx: 1, bodyDy: 1, eyeDy: 1, legsDy: 0, blink: true, fringeDx: 0 },
  ],
  waiting: [
    { shiftX: 0, headDx: 0, headDy: -1, bodyDx: 0, bodyDy: 0, eyeDy: -1, legsDy: 0, blink: false, fringeDx: 0 },
    { shiftX: 0, headDx: 0, headDy: -1, bodyDx: 0, bodyDy: 0, eyeDy: -1, legsDy: 0, blink: true, fringeDx: 0 },
  ],
  success: [{ shiftX: 0, headDx: 0, headDy: 0, bodyDx: 0, bodyDy: 0, eyeDy: 0, legsDy: -1, blink: false, fringeDx: 0 }],
  error: [{ shiftX: 0, headDx: 0, headDy: 1, bodyDx: 0, bodyDy: 1, eyeDy: 1, legsDy: 0, blink: true, fringeDx: 0 }],
  retry: [
    { shiftX: -1, headDx: 0, headDy: 0, bodyDx: 0, bodyDy: 0, eyeDy: 0, legsDy: 0, blink: false, fringeDx: 0 },
    { shiftX: 1, headDx: 0, headDy: 0, bodyDx: 0, bodyDy: 0, eyeDy: 0, legsDy: 0, blink: true, fringeDx: 0 },
  ],
};

function drawRegular(canvas: Canvas, pose: Pose): void {
  const headX = pose.shiftX + pose.headDx;
  const headY = pose.headDy;
  const bodyX = pose.shiftX + pose.bodyDx;
  const bodyY = pose.bodyDy;
  const legX = pose.shiftX;
  const legY = pose.legsDy;
  const hairRows = [
    { y: 2, x: 6, width: 12 }, { y: 3, x: 4, width: 16 }, { y: 4, x: 2, width: 20 },
    { y: 5, x: 2, width: 20 }, { y: 6, x: 2, width: 20 }, { y: 7, x: 2, width: 20 },
    { y: 8, x: 2, width: 20 }, { y: 9, x: 2, width: 20 }, { y: 10, x: 3, width: 18 },
  ];
  for (const row of hairRows) canvas.fill({ x: row.x + headX, y: row.y + headY, width: row.width, height: 1, color: PALETTE_INDEX.hairShadow });
  canvas.fill({ x: 5 + headX, y: 3 + headY, width: 14, height: 1, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 4 + headX, y: 4 + headY, width: 16, height: 6, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 5 + headX, y: 10 + headY, width: 14, height: 1, color: PALETTE_INDEX.hairBase });
  canvas.pixel(7 + headX + pose.fringeDx, 4 + headY, PALETTE_INDEX.hairLight);
  canvas.fill({ x: 2 + headX, y: 10 + headY, width: 2, height: 5, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 2 + headX, y: 14 + headY, width: 2, height: 1, color: PALETTE_INDEX.hairLight });
  canvas.fill({ x: 6 + headX, y: 5 + headY, width: 12, height: 1, color: PALETTE_INDEX.skin });
  canvas.fill({ x: 5 + headX, y: 6 + headY, width: 14, height: 4, color: PALETTE_INDEX.skin });
  canvas.fill({ x: 6 + headX, y: 10 + headY, width: 12, height: 1, color: PALETTE_INDEX.skin });
  canvas.pixel(8 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
  canvas.pixel(9 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeBlue);
  canvas.pixel(14 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeBlue);
  canvas.pixel(15 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
  if (pose.blink) {
    canvas.pixel(9 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
    canvas.pixel(14 + headX, 7 + headY + pose.eyeDy, PALETTE_INDEX.eyeBlue);
  }
  canvas.fill({ x: 5 + bodyX, y: 11 + bodyY, width: 14, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 4 + bodyX, y: 12 + bodyY, width: 16, height: 5, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 6 + bodyX, y: 12 + bodyY, width: 12, height: 5, color: PALETTE_INDEX.uniform });
  canvas.fill({ x: 5 + bodyX, y: 12 + bodyY, width: 1, height: 4, color: PALETTE_INDEX.trimWarmWhite });
  canvas.fill({ x: 18 + bodyX, y: 12 + bodyY, width: 1, height: 4, color: PALETTE_INDEX.trimWarmWhite });
  canvas.fill({ x: 10 + bodyX, y: 11 + bodyY, width: 4, height: 1, color: PALETTE_INDEX.ribbonRed });
  canvas.fill({ x: 11 + bodyX, y: 12 + bodyY, width: 2, height: 2, color: PALETTE_INDEX.ribbonRed });
  canvas.fill({ x: 4 + bodyX, y: 17 + bodyY, width: 16, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 6 + bodyX, y: 17 + bodyY, width: 12, height: 1, color: PALETTE_INDEX.uniform });
  canvas.fill({ x: 5 + bodyX, y: 18 + bodyY, width: 14, height: 1, color: PALETTE_INDEX.ribbonRed });
  canvas.fill({ x: 7 + legX, y: 19 + legY, width: 4, height: 4, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 8 + legX, y: 19 + legY, width: 2, height: 4, color: PALETTE_INDEX.sockBlack });
  canvas.fill({ x: 13 + legX, y: 19 + legY, width: 4, height: 4, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 14 + legX, y: 19 + legY, width: 2, height: 4, color: PALETTE_INDEX.sockBlack });
  canvas.fill({ x: 6 + legX, y: 23 + legY, width: 5, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 7 + legX, y: 23 + legY, width: 3, height: 1, color: PALETTE_INDEX.bootRedBrown });
  canvas.fill({ x: 13 + legX, y: 23 + legY, width: 5, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 14 + legX, y: 23 + legY, width: 3, height: 1, color: PALETTE_INDEX.bootRedBrown });
}

function drawCompact(canvas: Canvas, pose: Pose): void {
  const headX = pose.shiftX + pose.headDx;
  const headY = pose.headDy;
  const bodyX = pose.shiftX + pose.bodyDx;
  const bodyY = pose.bodyDy;
  const legX = pose.shiftX;
  const legY = pose.legsDy;
  const hairRows = [
    { y: 2, x: 5, width: 6 }, { y: 3, x: 3, width: 10 }, { y: 4, x: 2, width: 12 },
    { y: 5, x: 2, width: 12 }, { y: 6, x: 2, width: 12 }, { y: 7, x: 2, width: 12 }, { y: 8, x: 3, width: 10 },
  ];
  for (const row of hairRows) canvas.fill({ x: row.x + headX, y: row.y + headY, width: row.width, height: 1, color: PALETTE_INDEX.hairShadow });
  canvas.fill({ x: 4 + headX, y: 3 + headY, width: 8, height: 1, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 3 + headX, y: 4 + headY, width: 10, height: 4, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 4 + headX, y: 8 + headY, width: 8, height: 1, color: PALETTE_INDEX.hairBase });
  canvas.pixel(6 + headX + pose.fringeDx, 4 + headY, PALETTE_INDEX.hairLight);
  canvas.fill({ x: 2 + headX, y: 8 + headY, width: 2, height: 3, color: PALETTE_INDEX.hairBase });
  canvas.fill({ x: 5 + headX, y: 5 + headY, width: 6, height: 1, color: PALETTE_INDEX.skin });
  canvas.fill({ x: 4 + headX, y: 6 + headY, width: 8, height: 2, color: PALETTE_INDEX.skin });
  canvas.fill({ x: 5 + headX, y: 8 + headY, width: 6, height: 1, color: PALETTE_INDEX.skin });
  canvas.pixel(5 + headX, 6 + headY + pose.eyeDy, PALETTE_INDEX.eyeBlue);
  canvas.pixel(6 + headX, 6 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
  canvas.pixel(10 + headX, 6 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
  canvas.pixel(11 + headX, 6 + headY + pose.eyeDy, PALETTE_INDEX.eyeBlue);
  if (pose.blink) canvas.pixel(5 + headX, 6 + headY + pose.eyeDy, PALETTE_INDEX.eyeDeep);
  canvas.fill({ x: 3 + bodyX, y: 9 + bodyY, width: 10, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 2 + bodyX, y: 10 + bodyY, width: 12, height: 2, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 4 + bodyX, y: 10 + bodyY, width: 8, height: 2, color: PALETTE_INDEX.uniform });
  canvas.fill({ x: 3 + bodyX, y: 10 + bodyY, width: 1, height: 2, color: PALETTE_INDEX.trimWarmWhite });
  canvas.fill({ x: 12 + bodyX, y: 10 + bodyY, width: 1, height: 2, color: PALETTE_INDEX.trimWarmWhite });
  canvas.fill({ x: 7 + bodyX, y: 9 + bodyY, width: 2, height: 2, color: PALETTE_INDEX.ribbonRed });
  canvas.fill({ x: 3 + bodyX, y: 12 + bodyY, width: 10, height: 1, color: PALETTE_INDEX.uniform });
  canvas.fill({ x: 2 + bodyX, y: 13 + bodyY, width: 12, height: 1, color: PALETTE_INDEX.ribbonRed });
  canvas.fill({ x: 4 + legX, y: 14 + legY, width: 3, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 5 + legX, y: 14 + legY, width: 1, height: 1, color: PALETTE_INDEX.sockBlack });
  canvas.fill({ x: 9 + legX, y: 14 + legY, width: 3, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 10 + legX, y: 14 + legY, width: 1, height: 1, color: PALETTE_INDEX.sockBlack });
  canvas.fill({ x: 3 + legX, y: 15 + legY, width: 4, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 4 + legX, y: 15 + legY, width: 2, height: 1, color: PALETTE_INDEX.bootRedBrown });
  canvas.fill({ x: 9 + legX, y: 15 + legY, width: 4, height: 1, color: PALETTE_INDEX.outline });
  canvas.fill({ x: 10 + legX, y: 15 + legY, width: 2, height: 1, color: PALETTE_INDEX.bootRedBrown });
}

function renderPlaceholderFrame(size: PetSize, state: PetState, frameIndex: number): PixelFrame {
  const width = SIZE_DIMENSIONS[size];
  const pose = POSES[state][frameIndex] ?? POSES[state][0];
  const canvas = makeCanvas(width);
  if (size === "regular") drawRegular(canvas, pose);
  else drawCompact(canvas, pose);
  return { width, height: width, pixels: canvas.pixels };
}

export function generatePlaceholderFrames(size: PetSize, state: PetState): PixelFrame[] {
  return Array.from({ length: FRAME_COUNTS[state] }, (_, frameIndex) => renderPlaceholderFrame(size, state, frameIndex));
}
