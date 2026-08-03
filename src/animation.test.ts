// AnimationController 单元测试（todo 4）。
// 全部经注入的 fake clock 驱动：now()/schedule()/cancel()，无真实计时器依赖。
import { describe, expect, it } from "vitest";
import { AnimationController, TRANSIENT_DURATION_MS } from "./animation";
import type { AnimationSpec, PixelFrame } from "./types";

// ---------- fixtures ----------

function makeFrame(width: 24 | 16, fill: number): PixelFrame {
  const height = width === 24 ? 24 : 16;
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) };
}

function makeSpec(fills: number[], frameDurationMs: number, loop: boolean, size: 24 | 16 = 24): AnimationSpec {
  return { frames: fills.map((f) => makeFrame(size, f)), frameDurationMs, loop };
}

// 两帧规格：pixels[0] 用 fill 值标识帧序（1/2/…），便于断言帧序列。
const idleSpec = makeSpec([1, 2], 400, true);
const thinkingSpec = makeSpec([3, 4], 200, true);
const retrySpec = makeSpec([9, 10], 200, true);
const successSpec = makeSpec([11, 12], 300, false);
const errorSpec = makeSpec([13, 14], 300, false);
const compactRetrySpec = makeSpec([21, 22], 200, true, 16);

// ---------- fake clock ----------

class FakeClock {
  private _now = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; cb: () => void }>();
  /** 累计 schedule 调用次数（验证单定时器不累积）。 */
  scheduleCalls = 0;
  /** 全部已登记回调（含已被 cancel 的，用于手动触发过期回调测 generation）。 */
  allCbs: (() => void)[] = [];

  now(): number {
    return this._now;
  }

  schedule(cb: () => void, ms: number): number {
    this.scheduleCalls += 1;
    this.allCbs.push(cb);
    const id = this.nextId++;
    this.timers.set(id, { at: this._now + ms, cb });
    return id;
  }

  cancel(id: number): void {
    this.timers.delete(id);
  }

  pendingCount(): number {
    return this.timers.size;
  }

  /** 按时间顺序执行到期定时器（<= target）；回调内新登记的定时器若仍 <= target 会继续执行。 */
  advance(ms: number): void {
    const target = this._now + ms;
    for (;;) {
      let earliestId: number | null = null;
      let earliestAt = Infinity;
      for (const [id, t] of this.timers) {
        if (t.at <= target && t.at < earliestAt) {
          earliestAt = t.at;
          earliestId = id;
        }
      }
      if (earliestId === null) break;
      const t = this.timers.get(earliestId)!;
      this.timers.delete(earliestId);
      this._now = earliestAt;
      t.cb();
    }
    this._now = target;
  }
}

function makeCtrl(clock: FakeClock, fpsCap?: number): AnimationController {
  return new AnimationController({
    now: () => clock.now(),
    schedule: (cb, ms) => clock.schedule(cb, ms),
    cancel: (id) => clock.cancel(id as number),
    fpsCap,
  });
}

// ---------- tests ----------

describe("AnimationController", () => {
  it("idle loop: 两帧按 400ms 交替推进、帧序列正确（fake clock 快进）", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("idle", "regular", idleSpec);
    expect(seen).toEqual([1]); // 首帧立即发出
    ctrl.start();
    expect(clock.pendingCount()).toBe(1); // 单一定时器

    clock.advance(399);
    expect(seen).toEqual([1]); // 400ms 前不推进
    clock.advance(1);
    expect(seen).toEqual([1, 2]);
    clock.advance(400);
    expect(seen).toEqual([1, 2, 1]);
    clock.advance(400);
    expect(seen).toEqual([1, 2, 1, 2]);
    clock.advance(400);
    expect(seen).toEqual([1, 2, 1, 2, 1]);
    expect(clock.pendingCount()).toBe(1);
  });

  it("fps cap: 帧间隔至少 167ms（全局 ≤6FPS）", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock); // 默认 fpsCap=6 → ceil(1000/6)=167
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));
    const fastSpec = makeSpec([1, 2], 100, true); // 100ms 规格被上限抬到 167ms

    ctrl.setState("idle", "regular", fastSpec);
    ctrl.start();
    clock.advance(166);
    expect(seen).toEqual([1]);
    clock.advance(1);
    expect(seen).toEqual([1, 2]);
    clock.advance(167);
    expect(seen).toEqual([1, 2, 1]);
    clock.advance(167);
    expect(seen).toEqual([1, 2, 1, 2]);
  });

  it("fps cap: 自定义 fpsCap=4 → 间隔 250ms", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock, 4);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));
    const fastSpec = makeSpec([1, 2], 100, true);

    ctrl.setState("idle", "regular", fastSpec);
    ctrl.start();
    clock.advance(249);
    expect(seen).toEqual([1]);
    clock.advance(1);
    expect(seen).toEqual([1, 2]);
  });

  it("pause: 暂停后 10 个 tick 无帧回调，start 后恢复推进", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("idle", "regular", idleSpec);
    ctrl.start();
    clock.advance(400);
    expect(seen).toEqual([1, 2]);

    ctrl.pause();
    expect(clock.pendingCount()).toBe(0); // 暂停即取消帧定时器
    for (let i = 0; i < 10; i++) clock.advance(400);
    expect(seen).toEqual([1, 2]); // 暂停期间无任何帧回调

    ctrl.start(); // 恢复
    clock.advance(400);
    expect(seen).toEqual([1, 2, 1]);
  });

  it("dispose: 取消全部调度、幂等，之后无任何回调", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("idle", "regular", idleSpec);
    ctrl.start();
    clock.advance(400);
    expect(seen).toEqual([1, 2]);

    ctrl.dispose();
    ctrl.dispose(); // 幂等
    expect(clock.pendingCount()).toBe(0);
    expect(() => ctrl.start()).not.toThrow();
    expect(() => ctrl.pause()).not.toThrow();
    clock.advance(10_000);
    expect(seen).toEqual([1, 2]); // 之后无任何回调
    expect(clock.pendingCount()).toBe(0);
  });

  it("状态切换回首帧；尺寸切换回首帧（不跨尺寸索引）", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("idle", "regular", idleSpec);
    ctrl.start();
    clock.advance(400);
    expect(seen).toEqual([1, 2]);

    ctrl.setState("thinking", "regular", thinkingSpec); // 状态切换
    expect(seen).toEqual([1, 2, 3]); // 立即回首帧
    expect(ctrl.currentFrame?.pixels[0]).toBe(3);
    expect(ctrl.currentState).toBe("thinking");
    clock.advance(200);
    expect(seen).toEqual([1, 2, 3, 4]);

    ctrl.setState("retry", "compact", compactRetrySpec); // 尺寸切换
    expect(seen).toEqual([1, 2, 3, 4, 21]); // 回到 compact 首帧
    expect(ctrl.currentSize).toBe("compact");
    expect(ctrl.currentFrame?.width).toBe(16);
    expect(ctrl.currentFrame?.height).toBe(16);
    clock.advance(200);
    expect(seen).toEqual([1, 2, 3, 4, 21, 22]);
    expect(clock.pendingCount()).toBe(1); // 仍只有单一定时器
  });

  it("animations 重新启用：重置当前状态首帧，不追赶禁用期间经过的帧", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("idle", "regular", idleSpec);
    ctrl.start();
    clock.advance(400);
    expect(seen).toEqual([1, 2]);

    ctrl.pause(); // animations=false：取消计时器
    clock.advance(60_000); // 禁用一分钟
    expect(seen).toEqual([1, 2]); // 禁用期间不推进

    ctrl.setState("idle", "regular", idleSpec); // 重新启用：重置到当前状态首帧
    ctrl.start();
    expect(seen).toEqual([1, 2, 1]); // 从首帧开始，不追赶
    clock.advance(399);
    expect(seen).toEqual([1, 2, 1]);
    clock.advance(1);
    expect(seen).toEqual([1, 2, 1, 2]);
  });

  it("long retry: 虚拟 10 分钟运行，定时器数量恒为 1（单定时器不累积）；dispose 两次幂等", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    ctrl.onFrame((f) => seen.push(f.pixels[0]));

    ctrl.setState("retry", "regular", retrySpec); // 200ms @6FPS → 间隔 200ms
    ctrl.start();
    expect(clock.pendingCount()).toBe(1);

    for (let t = 0; t < 600; t++) {
      // 600 秒 = 10 虚拟分钟，每秒 5 帧
      clock.advance(1000);
      expect(clock.pendingCount()).toBe(1); // 任意时刻恒为 1
    }
    // 1 首帧 + 3000 tick
    expect(seen.length).toBe(3001);
    expect(seen[0]).toBe(9);
    expect(seen[1]).toBe(10);
    expect(seen[3000]).toBe(9); // 帧序按 200ms 精确循环
    // 每帧只重新登记一次定时器：调度总数 === 帧回调总数（无累积、无追赶）
    expect(clock.scheduleCalls).toBe(seen.length);

    ctrl.dispose();
    ctrl.dispose(); // 幂等
    expect(clock.pendingCount()).toBe(0);
    clock.advance(10_000);
    expect(seen.length).toBe(3001); // 之后无任何回调
  });

  it("loop=false: success/error 一次性播放一遍后停在末帧（不循环）；瞬态期限回调", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    let transientEnds = 0;
    ctrl.onFrame((f) => seen.push(f.pixels[0]));
    ctrl.onTransientEnd(() => (transientEnds += 1));

    ctrl.setState("success", "regular", successSpec);
    expect(seen).toEqual([11]);
    ctrl.start();
    clock.advance(300);
    expect(seen).toEqual([11, 12]); // 播到末帧
    expect(ctrl.currentFrame?.pixels[0]).toBe(12);
    clock.advance(5000);
    expect(seen).toEqual([11, 12]); // 停在末帧，不循环
    expect(transientEnds).toBe(1); // success 瞬态 2500ms 到期
    expect(clock.pendingCount()).toBe(0);

    ctrl.start(); // 已播完的一次性动画不再重播
    clock.advance(5000);
    expect(seen).toEqual([11, 12]);

    ctrl.setState("error", "regular", errorSpec);
    ctrl.start();
    clock.advance(300);
    expect(seen).toEqual([11, 12, 13, 14]);
    clock.advance(TRANSIENT_DURATION_MS.error - 301); // 距到期还差 1ms
    expect(transientEnds).toBe(1); // error 4000ms 未到期
    clock.advance(1);
    expect(transientEnds).toBe(2); // 到期
  });

  it("generation token: 过期回调不覆盖新状态", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    let transientEnds = 0;
    ctrl.onFrame((f) => seen.push(f.pixels[0]));
    ctrl.onTransientEnd(() => (transientEnds += 1));

    // 过期瞬态回调：success 时登记，切到 idle 后手动触发 → 被 generation 拒绝
    ctrl.setState("success", "regular", successSpec);
    ctrl.start();
    const staleTransientCb = clock.allCbs[0]; // success 瞬态计时器回调
    ctrl.setState("idle", "regular", idleSpec); // 新状态，generation++，旧回调作废
    expect(seen).toEqual([11, 1]); // success 首帧 + idle 首帧
    staleTransientCb();
    expect(transientEnds).toBe(0); // 过期回调不触发

    // 过期帧回调：idle 时登记的帧计时器，切到 thinking 后手动触发 → 不产出旧帧
    const staleFrameCb = clock.allCbs[clock.allCbs.length - 1]; // idle 帧计时器回调
    ctrl.setState("thinking", "regular", thinkingSpec);
    expect(seen).toEqual([11, 1, 3]);
    staleFrameCb();
    expect(seen).toEqual([11, 1, 3]); // 不产出 idle 第 2 帧
    expect(clock.pendingCount()).toBe(1); // 新状态只登记一个新帧定时器

    clock.advance(200);
    expect(seen).toEqual([11, 1, 3, 4]); // 新状态正常推进
  });

  it("onFrame/onTransientEnd 退订后不再收到回调", () => {
    const clock = new FakeClock();
    const ctrl = makeCtrl(clock);
    const seen: number[] = [];
    let transientEnds = 0;
    const offFrame = ctrl.onFrame((f) => seen.push(f.pixels[0]));
    const offTransient = ctrl.onTransientEnd(() => (transientEnds += 1));

    offFrame();
    offTransient();
    ctrl.setState("success", "regular", successSpec);
    ctrl.start();
    clock.advance(10_000);
    expect(seen).toEqual([]); // 退订后首帧也不送达
    expect(transientEnds).toBe(0);
  });
});
