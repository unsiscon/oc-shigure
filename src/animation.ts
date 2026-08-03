// 动画控制器（todo 4 交付物）。
// 帧推进器：按 AnimationSpec 步进帧、执行全局 ≤6FPS 上限、管理 success/error 瞬态期限。
// 不直接调用 UI：只通过 onFrame/onTransientEnd 订阅对外通知，不在此做状态归约。
// 所有时间行为都经注入的 now()/schedule()/cancel()，生产环境请注入单调时钟
// （performance.now()/process.hrtime），禁止 Date.now()；测试注入 fake clock。
import type { AnimationSpec, PetSize, PetState, PixelFrame } from "./types";

/** 默认全局帧率上限：≤6FPS → 两帧渲染间隔 ≥ ceil(1000/6) = 167ms（docs/04 §3.4）。 */
export const DEFAULT_FPS_CAP = 6;

/** success/error 瞬态期限（docs/03 §5：success 2500ms / error 4000ms，monotonic 计时）。 */
export const TRANSIENT_DURATION_MS: Record<"success" | "error", number> = {
  success: 2500,
  error: 4000,
};

/** 每控制器统一计时器登记表的键：动画时钟与瞬态期限共用（docs/04 §5 生命周期登记）。 */
export type TimerKind = "frame" | "transient";

export interface AnimationControllerOptions {
  /** 单调时钟读取（测试注入 fake clock）。 */
  now(): number;
  /** 注册一次性定时器，返回可取消句柄；全部计时经此注入，控制器不碰真实计时器。 */
  schedule(cb: () => void, ms: number): unknown;
  /** 取消句柄对应的定时器（幂等）。 */
  cancel(id: unknown): void;
  /** 全局帧率上限（FPS），默认 6；实际帧间隔 = max(frameDurationMs, ceil(1000/fpsCap))。 */
  fpsCap?: number;
}

/**
 * 动画控制器（docs/04 §3.4 动画职责）：
 * - 选择当前状态的动画序列（spec 由调用方从 manifest.sizes[size][state] 取出后传入）；
 * - 状态/尺寸切换重置到首帧（docs/03 §11）；
 * - 重新启用动画（animations=false → true）时，调用方再次 setState 同状态即可
 *   重置首帧、不追赶禁用期间经过的帧；
 * - disabled / animations=false / visible=false 时调用 pause()：取消帧定时器、停在当前帧
 *   （瞬态期限定时器继续保留，保证状态机仍能收到 success/error 到期信号）；
 * - 只维护单一定时器（frame 槽位），重新登记前必先取消，长循环运行不累积；
 * - dispose() 取消全部调度且幂等；回调内校验 generation token，过期回调不覆盖新状态。
 */
export class AnimationController {
  private readonly opts: AnimationControllerOptions;
  private readonly fpsCap: number;

  /** 统一计时器登记表：动画帧与瞬态期限共用一个 Map<timerKind, handle>。 */
  private readonly timers = new Map<TimerKind, unknown>();
  private readonly frameSubscribers = new Set<(frame: PixelFrame) => void>();
  private readonly transientSubscribers = new Set<() => void>();

  private state: PetState | null = null;
  private size: PetSize | null = null;
  private spec: AnimationSpec | null = null;
  private frameIndex = 0;
  /** 每次 setState 递增：过期回调凭此被拒绝（docs/03 §5 generation token）。 */
  private generation = 0;
  private started = false;
  private paused = false;
  private disposed = false;
  /** 一次性（loop=false）动画已播到末帧：start() 不再重播。 */
  private finished = false;

  constructor(opts: AnimationControllerOptions) {
    this.opts = opts;
    this.fpsCap = Math.max(1, Math.floor(opts.fpsCap ?? DEFAULT_FPS_CAP));
  }

  get currentState(): PetState | null {
    return this.state;
  }

  get currentSize(): PetSize | null {
    return this.size;
  }

  get currentFrame(): PixelFrame | null {
    return this.spec ? this.spec.frames[this.frameIndex] : null;
  }

  /** 订阅帧回调；返回退订函数。 */
  onFrame(cb: (frame: PixelFrame) => void): () => void {
    this.frameSubscribers.add(cb);
    return () => {
      this.frameSubscribers.delete(cb);
    };
  }

  /** 订阅 success/error 瞬态到期回调；返回退订函数。 */
  onTransientEnd(cb: () => void): () => void {
    this.transientSubscribers.add(cb);
    return () => {
      this.transientSubscribers.delete(cb);
    };
  }

  /**
   * 切换状态/尺寸：取对应 spec，重置到首帧并立即发出首帧；
   * 覆盖同状态（如 animations 重新启用）同样重置首帧，不追赶禁用期间经过的帧。
   */
  setState(state: PetState, size: PetSize, spec: AnimationSpec): void {
    if (this.disposed) return;
    this.generation += 1; // 作废所有在途回调
    this.cancelTimer("frame");
    this.cancelTimer("transient");
    this.state = state;
    this.size = size;
    this.spec = spec;
    this.frameIndex = 0;
    this.finished = false;
    this.emitFrame();
    if (state === "success" || state === "error") {
      this.armTransient(state);
    }
    if (this.started && !this.paused) {
      this.armFrame();
    }
  }

  /** 开始/恢复推进帧。已在推进中调用为无操作；已播完的一次性动画不重播。 */
  start(): void {
    if (this.disposed) return;
    if (this.started && !this.paused) return;
    this.started = true;
    this.paused = false;
    const spec = this.spec;
    if (spec && (spec.loop || !this.finished)) {
      this.armFrame();
    }
  }

  /** 暂停：取消帧定时器、停在当前帧，之后不推进（disabled/animations=false/visible=false 时调用）。 */
  pause(): void {
    if (this.disposed) return;
    this.paused = true;
    this.cancelTimer("frame");
  }

  /** 取消全部调度；幂等。之后任何操作（含重复 dispose）均无副作用。 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.cancelTimer("frame");
    this.cancelTimer("transient");
  }

  // ---------- internal ----------

  /** 全局 ≤6FPS：两帧渲染间隔 ≥ max(frameDurationMs, ceil(1000/fpsCap))。 */
  private get frameIntervalMs(): number {
    const spec = this.spec;
    const minInterval = Math.ceil(1000 / this.fpsCap);
    return spec ? Math.max(spec.frameDurationMs, minInterval) : minInterval;
  }

  private emitFrame(): void {
    const spec = this.spec;
    if (!spec) return;
    const frame = spec.frames[this.frameIndex];
    for (const cb of this.frameSubscribers) cb(frame);
  }

  /** 登记下一帧定时器（单一定时器：登记前先取消旧槽位，恒为 1 个在途）。 */
  private armFrame(): void {
    if (this.disposed) return;
    this.cancelTimer("frame");
    const token = this.generation;
    const handle = this.opts.schedule(() => this.tickFrame(token), this.frameIntervalMs);
    this.timers.set("frame", handle);
  }

  private tickFrame(token: number): void {
    this.timers.delete("frame"); // 该句柄已触发，不再在途
    if (this.disposed || !this.started || token !== this.generation) return;
    const spec = this.spec;
    if (!spec) return;
    const lastIndex = spec.frames.length - 1;
    if (spec.loop) {
      this.frameIndex = this.frameIndex >= lastIndex ? 0 : this.frameIndex + 1;
      this.emitFrame();
      this.armFrame();
    } else if (this.frameIndex < lastIndex) {
      this.frameIndex += 1;
      this.emitFrame();
      if (this.frameIndex < lastIndex) {
        this.armFrame();
      } else {
        this.finished = true; // 一次性：停在末帧，不再调度（不循环）
      }
    } else {
      this.finished = true;
    }
  }

  /** 登记 success/error 瞬态期限定时器；到期通知订阅者（上层据此切回归约结果）。 */
  private armTransient(kind: "success" | "error"): void {
    if (this.disposed) return;
    this.cancelTimer("transient");
    const token = this.generation;
    const handle = this.opts.schedule(() => {
      this.timers.delete("transient");
      if (this.disposed || token !== this.generation) return;
      for (const cb of this.transientSubscribers) cb();
    }, TRANSIENT_DURATION_MS[kind]);
    this.timers.set("transient", handle);
  }

  private cancelTimer(kind: TimerKind): void {
    const handle = this.timers.get(kind);
    if (handle !== undefined) {
      this.opts.cancel(handle);
      this.timers.delete(kind);
    }
  }
}
