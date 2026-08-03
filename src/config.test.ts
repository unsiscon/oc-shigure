import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type KV } from "./config";

function makeKV(initial: Record<string, unknown> = {}): KV & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    store,
    get(key, fallback) {
      return store.has(key) ? store.get(key) : fallback;
    },
    set(key, value) {
      store.set(key, value);
    },
  };
}

describe("config", () => {
  it("defaults: 空 KV → 默认三项", () => {
    const kv = makeKV();
    expect(loadConfig(kv)).toEqual(DEFAULT_CONFIG);
  });

  it("defaults: set 后回读一致", () => {
    const kv = makeKV();
    saveConfig(kv, { enabled: false, size: "compact", animations: false });
    expect(loadConfig(kv)).toEqual({ enabled: false, size: "compact", animations: false });
    expect(kv.store.get("opco-shigure.enabled")).toBe(false);
    expect(kv.store.get("opco-shigure.size")).toBe("compact");
    expect(kv.store.get("opco-shigure.animations")).toBe(false);
  });

  describe("illegal", () => {
    it("illegal: enabled=\"垃圾\" → 仅 enabled 回退默认，size/animations 保留", () => {
      const kv = makeKV({
        "opco-shigure.enabled": "垃圾",
        "opco-shigure.size": "compact",
        "opco-shigure.animations": false,
      });
      expect(loadConfig(kv)).toEqual({ enabled: true, size: "compact", animations: false });
    });

    it("illegal: size=\"huge\" → 仅 size 回退默认，enabled/animations 保留", () => {
      const kv = makeKV({
        "opco-shigure.enabled": false,
        "opco-shigure.size": "huge",
        "opco-shigure.animations": false,
      });
      expect(loadConfig(kv)).toEqual({ enabled: false, size: "regular", animations: false });
    });

    it("illegal: animations=null → 仅 animations 回退默认，enabled/size 保留", () => {
      const kv = makeKV({
        "opco-shigure.enabled": false,
        "opco-shigure.size": "compact",
        "opco-shigure.animations": null,
      });
      expect(loadConfig(kv)).toEqual({ enabled: false, size: "compact", animations: true });
    });
  });
});
