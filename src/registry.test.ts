// todo 7：会话控制器注册表 TDD 测试（先红后绿）。
//
// 全部时间行为经注入的 fake clock（now/schedule/cancel），无真实计时器。
// fake api 可控返回 state.session.status/permission/question 与 kv/state.ready。
// 验收口径：docs/03 §7/§8（会话边界/重水合）、docs/06 §7（可靠性）、FR-5（故障降级）。
import { describe, expect, it } from "vitest";
import type { Event } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { SHIGURE_MANIFEST } from "./manifest";
import { ControllerRegistry, PetController, STATIC_IDLE_FRAME } from "./registry";
import type { CharacterManifest, PetConfig, PetState } from "./types";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const CFG: PetConfig = { enabled: true, size: "regular", animations: true };
const CFG_COMPACT: PetConfig = { enabled: true, size: "compact", animations: true };
const CFG_NO_ANIM: PetConfig = { enabled: true, size: "regular", animations: false };
const CFG_DISABLED: PetConfig = { enabled: false, size: "regular", animations: true };

/** 构造 SDK 形状的最小事件对象（与 adapter.test 同构）。 */
function ev(type: string, properties: Record<string, unknown>, id = "evt-1"): Event {
  return { id, type, properties } as Event;
}

// ---------------------------------------------------------------------------
// fake clock（与 animation.test 同构）
// ---------------------------------------------------------------------------

class FakeClock {
  private _now = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; cb: () => void }>();

  now(): number {
    return this._now;
  }

  schedule(cb: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this._now + ms, cb });
    return id;
  }

  cancel(id: number): void {
    this.timers.delete(id);
  }

  /** 当前在途定时器数量（动画帧 + 瞬态期限合计）。 */
  pendingCount(): number {
    return this.timers.size;
  }

  /** 按时间顺序执行到期定时器（<= target）；回调内新登记且仍 <= target 的继续执行。 */
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

// ---------------------------------------------------------------------------
// fake api（state.session.status/permission/question 可控；kv/state.ready 可控）
// ---------------------------------------------------------------------------

class FakeApi {
  kvReady = true;
  stateReady = true;
  failReads = false;
  status: { type: "idle" } | { type: "busy" } | { type: "retry"; attempt: number; message: string; next: number } | undefined = {
    type: "idle",
  };
  permissions: unknown[] = [];
  questions: unknown[] = [];

  readonly kv = {
    get: () => undefined,
    set: () => {},
  };
  readonly state = {
    session: {
      status: (sessionID: string) => {
        if (this.failReads) throw new Error("read failed");
        return this.status;
      },
      permission: (sessionID: string) => {
        if (this.failReads) throw new Error("read failed");
        return this.permissions;
      },
      question: (sessionID: string) => {
        if (this.failReads) throw new Error("read failed");
        return this.questions;
      },
    },
  };

  asApi(): TuiPluginApi {
    const api = {
      kv: { ready: this.kvReady, ...this.kv },
      state: { ready: this.stateReady, ...this.state },
    };
    return api as unknown as TuiPluginApi;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeController(sessionID: string, clock: FakeClock, manifest?: CharacterManifest): PetController {
  return new PetController(sessionID, clock, manifest);
}

/** 缺帧的坏 manifest：regular/thinking 无帧（资源异常注入）。 */
function brokenManifest(): CharacterManifest {
  const broken = JSON.parse(JSON.stringify(SHIGURE_MANIFEST)) as unknown as CharacterManifest;
  (broken.sizes.regular as unknown as Record<string, unknown>).thinking = {
    frames: [],
    frameDurationMs: 200,
    loop: true,
  };
  return broken;
}

// ---------------------------------------------------------------------------
// ControllerRegistry 生命周期
// ---------------------------------------------------------------------------

describe("ControllerRegistry 生命周期（docs/06 §7 / FR-5）", () => {
  it("getOrCreate 同 sessionID 返回同一实例；get 返回缓存实例", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const a = registry.getOrCreate("s1");
    expect(registry.getOrCreate("s1")).toBe(a);
    expect(registry.get("s1")).toBe(a);
  });

  it("get 未创建会话返回 undefined", () => {
    const registry = new ControllerRegistry(new FakeClock());
    expect(registry.get("ghost")).toBeUndefined();
  });

  it("dispose 取消计时器、清缓存且幂等（双重 dispose）", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const ctrl = registry.getOrCreate("s1");
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true); // 组件 onMount 置 true 后动画才启动
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));
    expect(clock.pendingCount()).toBeGreaterThan(0); // 动画帧在途

    registry.dispose("s1");
    expect(clock.pendingCount()).toBe(0);
    expect(registry.get("s1")).toBeUndefined();
    registry.dispose("s1"); // 幂等：不抛错
    expect(registry.get("s1")).toBeUndefined();
  });

  it("disposeAll 清空全部控制器且取消全部计时器", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const c1 = registry.getOrCreate("s1");
    const c2 = registry.getOrCreate("s2");
    c1.applyConfig(CFG);
    c1.hydrate(new FakeApi().asApi());
    c1.setVisible(true);
    c2.applyConfig(CFG);
    c2.hydrate(new FakeApi().asApi());
    c2.setVisible(true);
    c1.handle(ev("session.next.step.started", { sessionID: "s1" }));
    c2.handle(ev("session.next.step.started", { sessionID: "s2" }));
    expect(clock.pendingCount()).toBe(2);

    registry.disposeAll();
    expect(clock.pendingCount()).toBe(0);
    expect(registry.get("s1")).toBeUndefined();
    expect(registry.get("s2")).toBeUndefined();
  });

  it("dispose 后 getOrCreate 重建全新实例（挂载/卸载循环不残留）", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const a = registry.getOrCreate("s1");
    registry.dispose("s1");
    const b = registry.getOrCreate("s1");
    expect(b).not.toBe(a);
    expect(registry.get("s1")).toBe(b);
  });

  it("热重载语义：重复 create/dispose 循环后无残留计时器、无重复注册（docs/06 §7）", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const api = new FakeApi().asApi();
    for (let i = 0; i < 20; i++) {
      const ctrl = registry.getOrCreate("s1");
      ctrl.applyConfig(CFG);
      ctrl.hydrate(api);
      const unsubFrame = ctrl.onFrame(() => {});
      const unsubState = ctrl.onState(() => {});
      unsubFrame();
      unsubFrame(); // 退订幂等
      unsubState();
      registry.dispose("s1");
    }
    expect(clock.pendingCount()).toBe(0);
    expect(registry.get("s1")).toBeUndefined();
  });

  it("lastActiveSessionID 追踪：有 sessionID 的事件更新，无 sessionID 的事件路由到最近活动会话（t8 归属）", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const ctrl = registry.getOrCreate("s1");
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());

    registry.dispatch(ev("session.next.step.started", { sessionID: "s1" }));
    expect(registry.lastActiveSessionID).toBe("s1");
    expect(ctrl.currentState).toBe("thinking");

    // 无 sessionID 的 session.error（error.name 缺失 → cycle-failed → error 瞬态）
    registry.dispatch(ev("session.error", { error: {} }));
    expect(ctrl.currentState).toBe("error");
    expect(registry.lastActiveSessionID).toBe("s1");
  });

  it("dispatch 未知会话事件不改变 lastActiveSessionID、不抛错", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const ctrl = registry.getOrCreate("s1");
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    registry.dispatch(ev("session.next.step.started", { sessionID: "s1" }));
    expect(registry.lastActiveSessionID).toBe("s1");

    registry.dispatch(ev("session.next.step.started", { sessionID: "ghost" }));
    expect(registry.lastActiveSessionID).toBe("s1");
    expect(ctrl.currentState).toBe("thinking");

    // 无任何会话时，无 sessionID 事件被忽略且不抛错
    const empty = new ControllerRegistry(clock);
    expect(() => empty.dispatch(ev("session.error", { error: {} }))).not.toThrow();
  });

  it("10,000 个无关/他会话事件不改当前状态（docs/06 §7）", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const ctrl = registry.getOrCreate("s1");
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);

    for (let i = 0; i < 10_000; i++) {
      registry.dispatch(ev("session.next.step.started", { sessionID: "other" }));
    }
    expect(ctrl.currentState).toBe("idle");
    expect(clock.pendingCount()).toBe(1); // 单一帧计时器，不随事件数增长

    // 属于本会话但未映射（allowlist 外）的事件同样不改状态
    for (let i = 0; i < 10_000; i++) {
      registry.dispatch(ev("message.part.updated", { sessionID: "s1", part: {} }));
    }
    expect(ctrl.currentState).toBe("idle");
    expect(clock.pendingCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PetController.handle：会话边界与分层降级
// ---------------------------------------------------------------------------

describe("PetController.handle（docs/03 §7、docs/04 §5、FR-5）", () => {
  it("S12 隔离：两会话独立实例，事件互不串扰", () => {
    const clock = new FakeClock();
    const registry = new ControllerRegistry(clock);
    const s1 = registry.getOrCreate("s1");
    const s2 = registry.getOrCreate("s2");
    s1.applyConfig(CFG);
    s2.applyConfig(CFG);
    s1.hydrate(new FakeApi().asApi());
    s2.hydrate(new FakeApi().asApi());

    registry.dispatch(ev("session.next.step.started", { sessionID: "s1" }));
    expect(s1.currentState).toBe("thinking");
    expect(s2.currentState).toBe("idle");

    registry.dispatch(ev("session.next.tool.input.started", { sessionID: "s2", callID: "c1" }));
    expect(s2.currentState).toBe("working");
    expect(s1.currentState).toBe("thinking");
  });

  it("handle 直接调用时过滤异会话事件（返回 false，不改状态）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());

    expect(ctrl.handle(ev("session.next.step.started", { sessionID: "s2" }))).toBe(false);
    expect(ctrl.currentState).toBe("idle");
    // 无 sessionID 事件放行（adapter 语义：交由上层路由）
    expect(ctrl.handle(ev("session.next.step.started", {}))).toBe(true);
    expect(ctrl.currentState).toBe("thinking");
  });

  it("事件适配错误 → 忽略 + debug（绝不抛错）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    // 缺 properties 的畸形事件：mapEvent 不抛，但验证整体不抛
    expect(() => ctrl.handle({ id: "x", type: "session.error" } as Event)).not.toThrow();
    expect(ctrl.currentState).toBe("idle");
  });

  it("资源/帧缺失异常 → 静态 idle 占位（SHIGURE_MANIFEST.sizes.regular.idle.frames[0]，FR-5）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock, brokenManifest());
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());

    // 驱动到缺帧的 thinking 状态
    expect(ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }))).toBe(true);
    expect(ctrl.currentState).toBe("idle");
    expect(ctrl.currentFrame).toBe(STATIC_IDLE_FRAME);
  });

  it("状态未变的事件不重置动画帧（避免无关事件把动画打回首帧）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" })); // thinking
    const firstFrame = ctrl.currentFrame;

    clock.advance(200); // thinking 帧间隔 200ms：恰好推进一帧
    const advancedFrame = ctrl.currentFrame;
    expect(advancedFrame).not.toBe(firstFrame);

    ctrl.handle(ev("session.next.reasoning.started", { sessionID: "s1" })); // 仍 thinking
    expect(ctrl.currentState).toBe("thinking");
    expect(ctrl.currentFrame).toBe(advancedFrame); // 未重置回首帧
  });

  it("长 retry/waiting 期间帧计时器不累积（恒单定时器，docs/06 §7）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);

    ctrl.handle(ev("session.next.retried", { sessionID: "s1" }));
    expect(ctrl.currentState).toBe("retry");
    clock.advance(10 * 60 * 1000); // 长 retry
    expect(clock.pendingCount()).toBe(1); // 仅 1 个帧定时器在途

    ctrl.handle(ev("permission.asked", { sessionID: "s1", id: "p1" }));
    expect(ctrl.currentState).toBe("waiting");
    clock.advance(10 * 60 * 1000); // 长 waiting
    expect(clock.pendingCount()).toBe(1);
  });

  it("success 瞬态到期后回落 idle（transient 计时器 → reduceExpired）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);

    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" })); // cycleActive
    ctrl.handle(ev("session.next.text.started", { sessionID: "s1", textID: "t1" }));
    ctrl.handle(ev("session.next.text.ended", { sessionID: "s1", textID: "t1", text: "" }));
    ctrl.handle(ev("session.idle", { sessionID: "s1" }));
    expect(ctrl.currentState).toBe("success");
    expect(clock.pendingCount()).toBe(2); // 帧 + 瞬态期限

    clock.advance(2500); // SUCCESS_DURATION_MS
    expect(ctrl.currentState).toBe("idle");
    expect(clock.pendingCount()).toBe(1); // 瞬态已清，仅帧计时器
  });

  it("dispose 后动画与瞬态计时器全部取消（fake clock 断言）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));
    ctrl.handle(ev("session.next.text.started", { sessionID: "s1", textID: "t1" }));
    ctrl.handle(ev("session.next.text.ended", { sessionID: "s1", textID: "t1", text: "" }));
    ctrl.handle(ev("session.idle", { sessionID: "s1" }));
    expect(ctrl.currentState).toBe("success");
    expect(clock.pendingCount()).toBe(2);

    ctrl.dispose();
    expect(clock.pendingCount()).toBe(0);
    ctrl.dispose(); // 幂等
    expect(clock.pendingCount()).toBe(0);
    // dispose 后 handle/hydrate/applyConfig 均为无操作
    expect(ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }))).toBe(false);
    expect(() => ctrl.hydrate(new FakeApi().asApi())).not.toThrow();
    expect(() => ctrl.applyConfig(CFG)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PetController.hydrate（docs/03 §8）
// ---------------------------------------------------------------------------

describe("PetController.hydrate（docs/03 §8、tui.d.ts status/permission/question）", () => {
  it("permission 非空 → waiting", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    const api = new FakeApi();
    api.permissions = [{ id: "p1" }];
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("waiting");
  });

  it("question 非空 → waiting（question 在 permission 之后判定）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    const api = new FakeApi();
    api.questions = [{ id: "q1" }];
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("waiting");
  });

  it("status retry → retry、busy → thinking、idle → idle、undefined → idle", () => {
    const retry = new FakeApi();
    retry.status = { type: "retry", attempt: 1, message: "m", next: 1 };
    const busy = new FakeApi();
    busy.status = { type: "busy" };
    const idle = new FakeApi();
    idle.status = { type: "idle" };
    const none = new FakeApi();
    none.status = undefined;

    const c1 = makeController("r", new FakeClock());
    c1.applyConfig(CFG);
    c1.hydrate(retry.asApi());
    expect(c1.currentState).toBe("retry");

    const c2 = makeController("b", new FakeClock());
    c2.applyConfig(CFG);
    c2.hydrate(busy.asApi());
    expect(c2.currentState).toBe("thinking");

    const c3 = makeController("i", new FakeClock());
    c3.applyConfig(CFG);
    c3.hydrate(idle.asApi());
    expect(c3.currentState).toBe("idle");

    const c4 = makeController("n", new FakeClock());
    c4.applyConfig(CFG);
    c4.hydrate(none.asApi());
    expect(c4.currentState).toBe("idle");
  });

  it("读取失败 → 静态 idle 且不轮询（无任何定时器）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.setVisible(true); // 即使动画/可见，静态 idle 也必须暂停
    const api = new FakeApi();
    api.failReads = true;
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("idle");
    expect(ctrl.currentFrame).toBe(STATIC_IDLE_FRAME);
    expect(clock.pendingCount()).toBe(0); // 不轮询重试
  });

  it("kv.ready=false → 静态 idle 不轮询", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.setVisible(true);
    const api = new FakeApi();
    api.kvReady = false;
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("idle");
    expect(ctrl.currentFrame).toBe(STATIC_IDLE_FRAME);
    expect(clock.pendingCount()).toBe(0);
  });

  it("state.ready=false → 静态 idle 不轮询", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.setVisible(true);
    const api = new FakeApi();
    api.stateReady = false;
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("idle");
    expect(clock.pendingCount()).toBe(0);
  });

  it("不恢复 success/error 瞬态：hydrate 只产出 idle/thinking/retry/waiting，不挂瞬态计时器（docs/03 §7:136）", () => {
    const scenarios: Array<{ label: string; setup: (api: FakeApi) => void; expectState: PetState }> = [
      { label: "permission→waiting", setup: (a) => (a.permissions = [{}]), expectState: "waiting" },
      { label: "status retry→retry", setup: (a) => (a.status = { type: "retry", attempt: 1, message: "m", next: 1 }), expectState: "retry" },
      { label: "status busy→thinking", setup: (a) => (a.status = { type: "busy" }), expectState: "thinking" },
      { label: "status idle→idle", setup: (a) => (a.status = { type: "idle" }), expectState: "idle" },
    ];
    for (const s of scenarios) {
      const clock = new FakeClock();
      const ctrl = makeController(`s-${s.label}`, clock);
      ctrl.applyConfig(CFG);
      const api = new FakeApi();
      s.setup(api);
      ctrl.hydrate(api.asApi());
      expect(ctrl.currentState).toBe(s.expectState);
      expect(["idle", "thinking", "retry", "waiting"]).toContain(ctrl.currentState);
      expect(ctrl.currentState).not.toBe("success");
      expect(ctrl.currentState).not.toBe("error");
      expect(clock.pendingCount()).toBe(0); // 瞬态计时器未被挂起
    }
  });

  it("hydrate 幂等：重复 hydrate 不改变已恢复状态、不新增计时器", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.setVisible(true);
    const api = new FakeApi();
    api.status = { type: "busy" };
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("thinking");
    ctrl.hydrate(api.asApi());
    expect(ctrl.currentState).toBe("thinking");
    expect(clock.pendingCount()).toBe(1); // 仅动画帧
  });
});

// ---------------------------------------------------------------------------
// PetController.applyConfig（docs/03 §11 设置行为，FR-3 即时生效）
// ---------------------------------------------------------------------------

describe("PetController.applyConfig（docs/03 §11）", () => {
  it("size 切换重置当前状态首帧（避免跨尺寸索引错误）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" })); // thinking/regular
    const regularFrame = ctrl.currentFrame;
    expect(regularFrame?.width).toBe(24);

    ctrl.applyConfig(CFG_COMPACT);
    expect(ctrl.currentState).toBe("thinking");
    expect(ctrl.currentFrame?.width).toBe(16); // compact 首帧
    expect(ctrl.currentFrame).toBe(SHIGURE_MANIFEST.sizes.compact.thinking.frames[0]);
  });

  it("animations=false → 暂停：无帧推进", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));
    let frames = 0;
    ctrl.onFrame(() => frames++);

    ctrl.applyConfig(CFG_NO_ANIM);
    expect(clock.pendingCount()).toBe(0);
    const before = frames; // 重置首帧的同步发射已计入
    clock.advance(60_000);
    expect(frames).toBe(before); // 无新帧
  });

  it("animations 重新启用 → 从当前状态首帧开始（不追赶禁用期间经过的帧）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" })); // thinking/regular
    const firstFrame = SHIGURE_MANIFEST.sizes.regular.thinking.frames[0];

    ctrl.applyConfig(CFG_NO_ANIM);
    clock.advance(60_000); // 禁用期间流逝
    const emitted: unknown[] = [];
    ctrl.onFrame((f) => emitted.push(f));
    ctrl.applyConfig(CFG); // 重新启用
    expect(ctrl.currentFrame).toBe(firstFrame);
    expect(emitted[0]).toBe(firstFrame); // 重新启用从首帧开始
  });

  it("enabled=false → 暂停；重新启用恢复播放", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));
    expect(clock.pendingCount()).toBe(1);

    ctrl.applyConfig(CFG_DISABLED);
    expect(clock.pendingCount()).toBe(0);

    ctrl.applyConfig(CFG);
    expect(clock.pendingCount()).toBe(1);
    expect(ctrl.currentFrame).toBe(SHIGURE_MANIFEST.sizes.regular.thinking.frames[0]);
  });

  it("visible=false → 暂停；visible=true → 恢复（组件 onMount/onCleanup 驱动）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));
    expect(clock.pendingCount()).toBe(1);

    ctrl.setVisible(false);
    expect(clock.pendingCount()).toBe(0);

    ctrl.setVisible(true);
    expect(clock.pendingCount()).toBe(1);
  });

  it("重复 mount/dispose 监听器数量不增长（订阅/退订行为验证）", () => {
    const clock = new FakeClock();
    const ctrl = makeController("s1", clock);
    ctrl.applyConfig(CFG);
    ctrl.hydrate(new FakeApi().asApi());
    ctrl.setVisible(true);
    ctrl.handle(ev("session.next.step.started", { sessionID: "s1" }));

    // 重复订阅/退订后，只有当前订阅者收到帧
    for (let i = 0; i < 10; i++) {
      const unsub = ctrl.onFrame(() => {});
      unsub();
    }
    let delivered = 0;
    const unsub = ctrl.onFrame(() => delivered++);
    const before = delivered;
    clock.advance(200); // thinking 帧间隔 200ms：恰好一帧
    expect(delivered).toBe(before + 1); // 恰好一个订阅者、恰好一帧
    unsub();
    clock.advance(200);
    expect(delivered).toBe(before + 1); // 退订后不再投递

    ctrl.dispose();
    expect(clock.pendingCount()).toBe(0);
  });
});
