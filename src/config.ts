import type { PetConfig, PetSize } from "./types";

/** 配置键统一以插件 ID 命名空间（docs/04 §3.7）。 */
export const CONFIG_KEYS = {
  enabled: "opco-shigure.enabled",
  size: "opco-shigure.size",
  animations: "opco-shigure.animations",
} as const;

export const DEFAULT_CONFIG: PetConfig = {
  enabled: true,
  size: "regular",
  animations: true,
};

/**
 * 最小配置注入接口：结构兼容 TuiKV 的
 * `{ get(key, fallback?), set(key, value), ready }`（多出的 ready 字段不影响赋值）。
 * 配置层不依赖 TUI API 具体实现，便于测试。
 */
export type KV = {
  get(key: string, fallback?: unknown): unknown;
  set(key: string, value: unknown): void;
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readSize(value: unknown, fallback: PetSize): PetSize {
  return value === "regular" || value === "compact" ? value : fallback;
}

/**
 * 读取配置：缺失/非法值做**单字段**回退默认，其他有效字段保留。
 * （docs/04 §3.7：对未知/非法值回退默认值；不清空其他有效偏好）
 */
export function loadConfig(kv: KV): PetConfig {
  return {
    enabled: readBoolean(kv.get(CONFIG_KEYS.enabled), DEFAULT_CONFIG.enabled),
    size: readSize(kv.get(CONFIG_KEYS.size), DEFAULT_CONFIG.size),
    animations: readBoolean(kv.get(CONFIG_KEYS.animations), DEFAULT_CONFIG.animations),
  };
}

export function saveConfig(kv: KV, cfg: PetConfig): void {
  kv.set(CONFIG_KEYS.enabled, cfg.enabled);
  kv.set(CONFIG_KEYS.size, cfg.size);
  kv.set(CONFIG_KEYS.animations, cfg.animations);
}
