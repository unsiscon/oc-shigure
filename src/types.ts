// opco-shigure 领域类型（todo 1 交付物）。
// 行优先像素索引指向 CharacterManifest.palette，索引 0 = 透明。

export type PetSize = "regular" | "compact";

export type PetState =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "success"
  | "error"
  | "retry";

export const PET_STATE_LABELS: Record<PetState, string> = {
  idle: "待机",
  thinking: "思考",
  working: "工作",
  waiting: "等待",
  success: "完成",
  error: "出错",
  retry: "重试",
};

export interface PetConfig {
  enabled: boolean;
  size: PetSize;
  animations: boolean;
}

export interface PixelFrame {
  width: 24 | 16;
  height: 24 | 16;
  /** 行优先，每个元素是 palette 索引；0 = 透明 */
  pixels: Uint8Array;
}

export interface AnimationSpec {
  frames: readonly PixelFrame[];
  frameDurationMs: number;
  loop: boolean;
}

export interface CharacterManifest {
  id: "shigure";
  displayName: "时雨";
  palette: readonly string[];
  sizes: Record<PetSize, Record<PetState, AnimationSpec>>;
}

/**
 * SDK 事件适配器产出的宠物事件联合（todo 2 消费）。
 * 注意：无 "retry-ended" —— SDK 与 docs/03 §4 均无 retry-end 事件来源，
 * retryActive 仅由 session.status idle/busy 与 cycle-failed/aborted 复位。
 */
export type PetEvent =
  | { type: "cycle-started" }
  | { type: "busy-started" }
  | { type: "reasoning-started" | "reasoning-ended" }
  | { type: "text-started" | "text-ended" }
  | { type: "tool-started" | "tool-ended"; callID: string; failed?: boolean }
  | { type: "permission-opened" | "permission-closed"; requestID: string }
  | { type: "question-opened" | "question-closed"; requestID: string }
  | { type: "retry-started" }
  | { type: "session-idle" }
  | { type: "cycle-failed" }
  | { type: "cycle-aborted" };
