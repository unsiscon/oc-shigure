import { auditFrame } from "../../../scripts/audit-art-noise";
import { decodeRow, ROW_CHARS } from "../../../src/assets/final";
import { readFileSync } from "node:fs";

// 直接构造 32x32 frame,绕开 parseGrid 的 16/24 尺寸限制
const rows = readFileSync(process.argv[2], "utf8").split("\n").filter((l) => l.length > 0);
const dim = rows.length;
const pixels = new Uint8Array(dim * dim);
rows.forEach((row, y) => decodeRow(row, y, dim, pixels));
const frame = { width: dim, height: dim, pixels };
const result = auditFrame(frame, { size: "regular", state: "idle", frameIndex: 0 });
console.log(JSON.stringify({ dim, violations: result.violations.length, boundaryCells: result.boundaryOutlineCellCount }));
process.exit(result.violations.length === 0 ? 0 : 1);
