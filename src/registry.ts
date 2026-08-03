// todo 7：会话控制器注册表。
//
// ControllerRegistry：plugin 级单例（todo 8 持有）。按 sessionID 缓存 PetController，
// 追踪 lastActiveSessionID（供无 sessionID 的 session.error 归属，t8 分发器使用）。
//
// PetController：组合 adapter 过滤 + reducer 归约 + AnimationController 动画 + hydration。
// - handle(event)：sessionID 过滤（docs/03 §7）→ mapEvent → reduceStep（注入单调 now）→
//   动画 setState（spec 取自 manifest.sizes[size][state]）；绝不向宿主抛错。
// - 异常按 docs/04 §5 分层降级：
//   事件适配错误 → 忽略该事件 + console.debug；
//   状态归约异常 → 重水合当前会话；
//   动画异常 → 当前状态首帧；
//   资源/帧缺失 → 内置静态 idle 占位（STATIC_IDLE_FRAME，编译期常量，FR-5:101-102）；
//   渲染异常由 sidebar 处理（仅标签）。
// - hydrate(api)：docs/03 §8 顺序——permission/question 非空 → waiting；否则
//   status：retry→retry、busy→thinking、idle/undefined→idle（tui.d.ts:307）；
//   不恢复 success/error 瞬态（docs/03 §7:136）；kv/state.ready=false 或读取失败
//   → 静态 idle，不轮询（docs/03:148）。
// - 计时器全部经注入的 ControllerClock（生产：performance.now/setTimeout/clearTimeout；
//   测试：fake clock），dispose 取消帧与瞬态计时器且幂等。
import type { Event } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { filterForSession, mapEvent } from "./adapter";
import { AnimationController } from "./animation";
import { SHIGURE_MANIFEST } from "./manifest";
import { initialFacts, reduceExpired, reduceStep, type SessionPetFacts, type TransientState } from "./reducer";
import { DEFAULT_CONFIG, type KV } from "./config";
import type { AnimationSpec, CharacterManifest, PetConfig, PetSize, PetState, PixelFrame } from "./types";

/** 注入式时钟/调度器：生产注入 performance.now + setTimeout/clearTimeout（单调）；测试注入 fake clock。 */
export interface ControllerClock {
  now(): number;
  schedule(cb: () => void, ms: number): unknown;
  cancel(id: unknown): void;
}

const DEFAULT_CLOCK: ControllerClock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  schedule: (cb, ms) => setTimeout(cb, ms),
  cancel: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * 内置静态 idle 占位帧：所有资源/帧缺失异常的最终回退（docs/02 FR-5:101-102）。
 * 编译期常量——生成器保证 SHIGURE_MANIFEST.sizes.regular.idle.frames[0] 始终存在。
 */
export const STATIC_IDLE_FRAME: PixelFrame = SHIGURE_MANIFEST.sizes.regular.idle.frames[0];

function propsOf(event: Event): Record<string, unknown> {
  return event.properties as Record<string, unknown>;
}

/** 当前状态首帧的单帧 spec（动画异常降级用，docs/04 §5）。 */
function firstFrameSpec(spec: AnimationSpec): AnimationSpec {
  const first = spec.frames[0];
  if (!first) throw new Error(`no frames for spec`);
  return { frames: [first], frameDurationMs: spec.frameDurationMs, loop: false };
}

export class PetController {
  readonly sessionID: string;

  private readonly clock: ControllerClock;
  private readonly manifest: CharacterManifest;
  private readonly animation: AnimationController;
  private api: TuiPluginApi | null = null;

  private facts: SessionPetFacts;
  private transientState: TransientState = { generation: 0 };
  private cfg: PetConfig = DEFAULT_CONFIG;
  private visible = false;
  private disposed = false;

  private readonly stateSubscribers = new Set<(state: PetState) => void>();

  constructor(sessionID: string, clock: ControllerClock, manifest: CharacterManifest = SHIGURE_MANIFEST) {
    this.sessionID = sessionID;
    this.clock = clock;
    this.manifest = manifest;
    this.facts = initialFacts(sessionID);
    this.animation = new AnimationController({
      now: () => clock.now(),
      schedule: (cb, ms) => clock.schedule(cb, ms),
      cancel: (id) => clock.cancel(id),
    });
    this.animation.onTransientEnd(() => this.handleTransientEnd());
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get currentState(): PetState | null {
    return this.animation.currentState;
  }

  get currentFrame(): PixelFrame | null {
    return this.animation.currentFrame;
  }

  /** 订阅帧回调（Solid signal 写入端）；返回退订函数（幂等）。 */
  onFrame(cb: (frame: PixelFrame) => void): () => void {
    return this.animation.onFrame(cb);
  }

  /** 订阅状态变更；返回退订函数（幂等）。 */
  onState(cb: (state: PetState) => void): () => void {
    this.stateSubscribers.add(cb);
    return () => {
      this.stateSubscribers.delete(cb);
    };
  }

  /**
   * 分发一个 SDK 事件：sessionID 过滤（不匹配忽略，docs/03 §7；无 sessionID 事件放行
   * 交由 registry 路由）→ 适配 → 归约 → 动画 setState。
   * 返回 true 表示事件已交付本控制器（成功分发，供 registry.lastActiveSessionID 记录）。
   * 绝不向宿主抛错（docs/04 §5）。
   */
  handle(event: Event): boolean {
    if (this.disposed) return false;
    try {
      if (!filterForSession(this.sessionID)(event)) return false;
    } catch (err) {
      // 畸形事件（缺 properties）：无法过滤 → 忽略 + debug（绝不抛错）
      console.debug("[opco-shigure] event filter error, ignoring", err);
      return false;
    }

    let petEvent: ReturnType<typeof mapEvent>;
    try {
      petEvent = mapEvent(event);
    } catch (err) {
      // 事件适配错误 → 忽略该事件 + debug（docs/04 §5）
      console.debug("[opco-shigure] event adaption error", err);
      return false;
    }
    if (!petEvent) return false;

    try {
      const result = reduceStep(this.facts, petEvent, this.clock.now(), this.transientState);
      this.facts = result.facts;
      this.transientState = { transient: result.transient, generation: result.generation };
      this.applyVisible(result.visible);
    } catch (err) {
      // 状态归约异常 → 重水合当前会话（docs/04 §5）
      console.debug("[opco-shigure] state reduction error, rehydrating", err);
      if (this.api) this.hydrate(this.api);
    }
    return true;
  }

  /**
   * 启动/重水合（docs/03 §8 顺序）：
   * 1. kv.ready/state.ready 为 false → 静态 idle，不轮询（docs/03:148）；
   * 2. permission/question 非空 → waiting；
   * 3. 否则 status：retry→retry、busy→thinking、idle/undefined→idle（tui.d.ts:307）；
   * 4. 读取失败 → 静态 idle，不轮询。
   * 不恢复 success/error 瞬态（docs/03 §7:136）。
   */
  hydrate(api: TuiPluginApi): void {
    if (this.disposed) return;
    this.api = api;

    // 组件重挂载（宿主侧栏布局变化会重新执行 slot renderer）也会走到 hydrate；
    // 活动中的 success/error 瞬态必须保留，不能被 status 快照覆盖
    // （真实冒烟观察到任务结束 200ms 内重挂载导致瞬态丢失）。
    const activeTransient = this.transientState.transient;
    if (activeTransient && this.clock.now() < activeTransient.until) {
      return;
    }

    if (!api.kv.ready || !api.state.ready) {
      this.staticIdle();
      return;
    }
    try {
      const permission = api.state.session.permission(this.sessionID);
      const question = api.state.session.question(this.sessionID);
      if (permission.length > 0 || question.length > 0) {
        this.applyVisible("waiting");
        return;
      }
      const status = api.state.session.status(this.sessionID);
      switch (status?.type) {
        case "retry":
          this.applyVisible("retry");
          break;
        case "busy":
          this.applyVisible("thinking");
          break;
        case "idle":
        default:
          // idle / undefined → idle（tui.d.ts:307 返回 SessionStatus | undefined）
          this.applyVisible("idle");
          break;
      }
    } catch (err) {
      // 读取失败 → 静态 idle，不轮询重试（docs/03:148）
      console.debug("[opco-shigure] hydration read failed, static idle", err);
      this.staticIdle();
    }
  }

  /**
   * 配置即时生效（FR-3，docs/03 §11）：size 切换重置当前状态首帧；
   * animations/enabled 切换 → 重置首帧并 start/pause；visible 由组件 onMount/onCleanup 驱动。
   */
  applyConfig(cfg: PetConfig): void {
    if (this.disposed) return;
    this.cfg = cfg;
    const state = this.animation.currentState;
    if (!state) return; // 尚未 hydrate：等 hydrate 时以最新 cfg 生效
    this.applyVisible(state, true); // 强制重置首帧（跨尺寸安全，docs/03 §11）
  }

  /** 组件 onMount 置 true / onCleanup 置 false；!visible 时 pause（docs/03 §11）。 */
  setVisible(visible: boolean): void {
    if (this.disposed) return;
    this.visible = visible;
    this.syncPlayback();
  }

  /** 取消全部计时器与订阅；幂等（docs/04 §5 生命周期登记）。 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animation.dispose();
    this.stateSubscribers.clear();
  }

  // ---------- internal ----------

  /**
   * 把可见状态落到动画控制器：spec 取自 manifest.sizes[size][state]。
   * 分层降级（docs/04 §5）：spec/帧缺失 → 静态 idle；动画异常 → 当前状态首帧。
   * 状态未变时不重置帧（无关事件不打回首帧）。
   */
  private applyVisible(state: PetState, force = false): void {
    if (this.disposed) return;
    if (!force && state === this.animation.currentState && this.cfg.size === this.animation.currentSize) {
      return; // 状态未变：不打断动画
    }

    let spec: AnimationSpec;
    try {
      spec = this.specFor(this.cfg.size, state);
    } catch (err) {
      // 资源异常（缺状态/尺寸）→ 静态 idle 占位
      console.debug("[opco-shigure] manifest spec missing, static idle", this.cfg.size, state, err);
      this.staticIdle();
      return;
    }
    if (spec.frames.length === 0) {
      // 帧缺失 → 静态 idle 占位（FR-5:101-102）
      console.debug("[opco-shigure] state has no frames, static idle", state);
      this.staticIdle();
      return;
    }

    try {
      this.animation.setState(state, this.cfg.size, spec);
    } catch (err) {
      // 动画异常 → 当前状态首帧
      console.debug("[opco-shigure] animation error, first frame fallback", err);
      try {
        this.animation.setState(state, this.cfg.size, firstFrameSpec(spec));
      } catch {
        this.staticIdle();
        return;
      }
    }
    this.emitState(state);
    this.syncPlayback();
  }

  /** 静态 idle 占位：内置 manifest 的 regular/idle 首帧，暂停（不轮询、不推进帧）。 */
  private staticIdle(): void {
    if (this.disposed) return;
    try {
      const spec = SHIGURE_MANIFEST.sizes.regular.idle; // 内置常量，不随注入 manifest
      this.animation.setState("idle", "regular", spec);
    } catch (err) {
      // 连内置占位都失败：保持现状（标签仍由 emitState 维持）
      console.debug("[opco-shigure] static idle fallback failed", err);
    }
    this.emitState("idle");
    this.animation.pause();
  }

  /** spec 查找：manifest.sizes[size][state]；缺失即抛（资源异常路径）。 */
  private specFor(size: PetSize, state: PetState): AnimationSpec {
    const spec = this.manifest.sizes[size]?.[state];
    if (!spec) throw new Error(`manifest missing ${size}/${state}`);
    return spec;
  }

  /** success/error 瞬态到期：reduceExpired 重新归约得出可见状态（docs/03 §5）。 */
  private handleTransientEnd(): void {
    if (this.disposed) return;
    try {
      const result = reduceExpired(this.facts, this.transientState, this.clock.now());
      this.transientState = { transient: result.transient, generation: result.generation };
      this.applyVisible(result.visible);
    } catch (err) {
      console.debug("[opco-shigure] transient expiry error, rehydrating", err);
      if (this.api) this.hydrate(this.api);
    }
  }

  private emitState(state: PetState): void {
    for (const cb of this.stateSubscribers) cb(state);
  }

  /** 播放策略：enabled && animations && visible 才推进帧；否则 pause。 */
  private syncPlayback(): void {
    if (this.disposed) return;
    if (this.cfg.enabled && this.cfg.animations && this.visible && this.animation.currentState !== null) {
      this.animation.start();
    } else {
      this.animation.pause();
    }
  }
}

/**
 * plugin 级单例（todo 8 持有）：按 sessionID 缓存控制器并统一生命周期。
 * getOrCreate 对已 dispose 的实例重建（组件切换/卸载后重挂载语义）。
 */
export class ControllerRegistry {
  private readonly controllers = new Map<string, PetController>();
  private readonly clock: ControllerClock;
  private _lastActiveSessionID: string | undefined;

  constructor(clock: ControllerClock = DEFAULT_CLOCK) {
    this.clock = clock;
  }

  /** 最近一次成功分发事件的 sessionID；无 sessionID 的 session.error 归属目标（t8 分发器使用）。 */
  get lastActiveSessionID(): string | undefined {
    return this._lastActiveSessionID;
  }

  /** 取或创建会话控制器（同实例缓存；已 dispose 则重建）。 */
  getOrCreate(sessionID: string): PetController {
    const existing = this.controllers.get(sessionID);
    if (existing && !existing.isDisposed) return existing;
    if (existing) this.controllers.delete(sessionID);
    const controller = new PetController(sessionID, this.clock);
    this.controllers.set(sessionID, controller);
    return controller;
  }

  get(sessionID: string): PetController | undefined {
    return this.controllers.get(sessionID);
  }

  /** 取消指定会话控制器的全部计时器并移除缓存；幂等。 */
  dispose(sessionID: string): void {
    const controller = this.controllers.get(sessionID);
    if (!controller) return;
    controller.dispose();
    this.controllers.delete(sessionID);
    if (this._lastActiveSessionID === sessionID) this._lastActiveSessionID = undefined;
  }

  /** 取消全部控制器计时器并清空；幂等（todo 8 在 api.lifecycle.onDispose 调用）。 */
  disposeAll(): void {
    for (const controller of this.controllers.values()) controller.dispose();
    this.controllers.clear();
    this._lastActiveSessionID = undefined;
  }

  /**
   * 事件分发入口（t8 对每个 SDK 事件类型调用）：有 sessionID → 路由到对应控制器
   * （成功分发则记录 lastActiveSessionID）；无 sessionID（如 session.error 缺省）
   * → 路由到 lastActiveSessionID 对应控制器，无则忽略。绝不抛错（docs/04 §5）。
   */
  dispatch(event: Event): void {
    try {
      const sessionID = propsOf(event).sessionID;
      if (typeof sessionID === "string") {
        const controller = this.controllers.get(sessionID);
        if (!controller) return;
        if (controller.handle(event)) this._lastActiveSessionID = sessionID;
      } else {
        const target =
          this._lastActiveSessionID !== undefined ? this.controllers.get(this._lastActiveSessionID) : undefined;
        target?.handle(event);
      }
    } catch (err) {
      console.debug("[opco-shigure] event dispatch error", err);
    }
  }
}

// 类型兼容声明：KV 形状与 TuiKV.get/set 子集一致（config.ts 最小注入接口）。
export type { KV };
