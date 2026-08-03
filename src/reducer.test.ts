// 状态归约器验收矩阵测试（docs/06 §3 S01-S15）。
// 确定性：所有测试注入 fake `now`（毫秒整数），不使用真实时钟/setTimeout。
import { describe, expect, it } from "vitest";
import type { PetEvent } from "./types";
import {
  initialFacts,
  reduceExpired,
  reduceFacts,
  reduceState,
  reduceStep,
  SUCCESS_DURATION_MS,
  ERROR_DURATION_MS,
  type SessionPetFacts,
  type TransientState,
} from "./reducer";

/** 以调用方视角推进：携带当前瞬态状态调用 reduceStep。 */
function step(
  facts: SessionPetFacts,
  event: PetEvent,
  now: number,
  current: TransientState = { generation: 0 },
) {
  return reduceStep(facts, event, now, current);
}

describe("reducer S01-S15 验收矩阵（docs/06 §3）", () => {
  it("S01: 初次进入 idle 会话 → idle，不播放 success", () => {
    const f = initialFacts("s1");
    expect(reduceState(f)).toBe("idle");
    const r = step(f, { type: "session-idle" }, 0);
    expect(r.visible).toBe("idle");
    expect(r.transient).toBeUndefined();
  });

  it("S02: step start→reasoning→tool start→tool end→text→idle：thinking→working→thinking→success→idle（fake clock 推进 2500ms）", () => {
    let r = step(initialFacts("s2"), { type: "cycle-started" }, 0);
    expect(r.visible).toBe("thinking");
    expect(r.transient).toBeUndefined();

    r = step(r.facts, { type: "reasoning-started" }, 100);
    expect(r.visible).toBe("thinking");

    r = step(r.facts, { type: "tool-started", callID: "A" }, 200);
    expect(r.visible).toBe("working");

    r = step(r.facts, { type: "tool-ended", callID: "A" }, 300);
    expect(r.visible).toBe("thinking");

    r = step(r.facts, { type: "text-started" }, 400);
    expect(r.visible).toBe("thinking");

    r = step(r.facts, { type: "text-ended" }, 500);
    expect(r.visible).toBe("thinking");

    // 完整周期后 idle → success（不要求 step.ended 前置）
    r = step(r.facts, { type: "session-idle" }, 600);
    expect(r.visible).toBe("success");
    expect(r.transient?.kind).toBe("success");
    expect(r.transient?.until).toBe(600 + SUCCESS_DURATION_MS);

    // 推进 fake clock 2500ms：瞬态过期 → 重新归约 → idle
    const e = reduceExpired(r.facts, { transient: r.transient, generation: r.generation }, 600 + SUCCESS_DURATION_MS);
    expect(e.visible).toBe("idle");
    expect(e.transient).toBeUndefined();
  });

  it("S03: tool start → permission asked：working → waiting（waiting 覆盖 working）", () => {
    let r = step(initialFacts("s3"), { type: "tool-started", callID: "A" }, 0);
    expect(r.visible).toBe("working");
    r = step(r.facts, { type: "permission-opened", requestID: "p1" }, 10);
    expect(r.visible).toBe("waiting");
    expect(r.facts.pendingPermissionIDs.has("p1")).toBe(true);
    expect(r.facts.activeToolCallIDs.has("A")).toBe(true);
  });

  it("S04: permission replied，tool 仍活动：waiting → working（不提前进入 thinking）", () => {
    let r = step(initialFacts("s4"), { type: "tool-started", callID: "A" }, 0);
    r = step(r.facts, { type: "permission-opened", requestID: "p1" }, 10);
    expect(r.visible).toBe("waiting");
    r = step(r.facts, { type: "permission-closed", requestID: "p1" }, 20);
    expect(r.visible).toBe("working");
    expect(r.facts.pendingPermissionIDs.size).toBe(0);
    expect(r.facts.activeToolCallIDs.has("A")).toBe(true);
  });

  it("S05: question asked/replied：waiting → 原活动态（pending 集合正确清除）", () => {
    let r = step(initialFacts("s5"), { type: "cycle-started" }, 0);
    expect(r.visible).toBe("thinking");
    r = step(r.facts, { type: "question-opened", requestID: "q1" }, 10);
    expect(r.visible).toBe("waiting");
    r = step(r.facts, { type: "question-closed", requestID: "q1" }, 20);
    expect(r.visible).toBe("thinking");
    expect(r.facts.pendingQuestionIDs.size).toBe(0);
  });

  it("S06: status retry → message delta → busy：retry → retry → thinking（普通增量不冲掉 retry）", () => {
    let r = step(initialFacts("s6"), { type: "retry-started" }, 0);
    expect(r.visible).toBe("retry");
    // message delta：文本增量不清 retryActive
    r = step(r.facts, { type: "text-started" }, 10);
    expect(r.visible).toBe("retry");
    expect(r.facts.retryActive).toBe(true);
    r = step(r.facts, { type: "text-ended" }, 20);
    expect(r.visible).toBe("retry");
    // status busy 复位 retry → thinking
    r = step(r.facts, { type: "busy-started" }, 30);
    expect(r.visible).toBe("thinking");
    expect(r.facts.retryActive).toBe(false);
  });

  it("S06b: retry 期间新 prompt（cycle-started）不打断 retry，直到 status busy/idle", () => {
    let r = step(initialFacts("s6b"), { type: "retry-started" }, 0);
    r = step(r.facts, { type: "cycle-started" }, 10);
    expect(r.facts.retryActive).toBe(true);
    expect(r.visible).toBe("retry");
    r = step(r.facts, { type: "busy-started" }, 20);
    expect(r.visible).toBe("thinking");
  });

  it("S07: tool A/B start → A end → B end：working → working → 重新归约（并发工具计数正确）", () => {
    let r = step(initialFacts("s7"), { type: "tool-started", callID: "A" }, 0);
    expect(r.visible).toBe("working");
    expect(r.facts.activeToolCallIDs.size).toBe(1);
    r = step(r.facts, { type: "tool-started", callID: "B" }, 10);
    expect(r.visible).toBe("working");
    expect(r.facts.activeToolCallIDs.size).toBe(2);
    r = step(r.facts, { type: "tool-ended", callID: "A" }, 20);
    expect(r.visible).toBe("working");
    expect(r.facts.activeToolCallIDs.has("B")).toBe(true);
    r = step(r.facts, { type: "tool-ended", callID: "B" }, 30);
    // 无 cycle/reasoning 事实 → 重新归约回 idle（docs/03:123 "thinking 或等待后续 idle"）
    expect(r.visible).toBe("idle");
    expect(r.facts.activeToolCallIDs.size).toBe(0);
  });

  it("S08: tool failed → new reasoning：error → thinking（可恢复活动打断 error）", () => {
    let r = step(initialFacts("s8"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "tool-started", callID: "A" }, 10);
    r = step(r.facts, { type: "tool-ended", callID: "A", failed: true }, 20);
    expect(r.visible).toBe("error");
    expect(r.transient?.kind).toBe("error");
    expect(r.transient?.until).toBe(20 + ERROR_DURATION_MS);
    // 新的 reasoning 立即打断 error
    r = step(r.facts, { type: "reasoning-started" }, 30, { transient: r.transient, generation: r.generation });
    expect(r.visible).toBe("thinking");
    expect(r.transient).toBeUndefined();
  });

  it("S09: session error（cycle-failed）：error 4s → idle，不显示 success", () => {
    let r = step(initialFacts("s9"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "tool-started", callID: "A" }, 10);
    r = step(r.facts, { type: "cycle-failed" }, 100);
    expect(r.visible).toBe("error");
    expect(r.transient?.until).toBe(100 + ERROR_DURATION_MS);
    expect(r.facts.cycleActive).toBe(false);
    expect(r.facts.retryActive).toBe(false);
    expect(r.facts.activeToolCallIDs.size).toBe(0);
    expect(r.facts.lastTerminalOutcome).toBe("error");

    // 完整 4s 后 → idle（重新归约，不无条件写 idle）
    const e = reduceExpired(r.facts, { transient: r.transient, generation: r.generation }, 100 + ERROR_DURATION_MS);
    expect(e.visible).toBe("idle");
    expect(e.transient).toBeUndefined();

    // 后续幽灵 session-idle 不触发 success（cycleActive 已复位）
    const ghost = step(r.facts, { type: "session-idle" }, 4200);
    expect(ghost.visible).toBe("idle");
    expect(ghost.transient).toBeUndefined();
  });

  it("S10: 用户中断（cycle-aborted）→ idle，不显示 success/error", () => {
    let r = step(initialFacts("s10"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "tool-started", callID: "A" }, 10);
    r = step(r.facts, { type: "cycle-aborted" }, 20);
    expect(r.visible).toBe("idle");
    expect(r.transient).toBeUndefined();
    expect(r.facts.cycleActive).toBe(false);
    expect(r.facts.retryActive).toBe(false);
    expect(r.facts.activeToolCallIDs.size).toBe(0);
    expect(r.facts.lastTerminalOutcome).toBe("aborted");
  });

  it("S10b: success 播放中被中断 → 回 idle（瞬态被清除）", () => {
    let r = step(initialFacts("s10b"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "session-idle" }, 100);
    expect(r.visible).toBe("success");
    r = step(r.facts, { type: "cycle-aborted" }, 150, { transient: r.transient, generation: r.generation });
    expect(r.visible).toBe("idle");
    expect(r.transient).toBeUndefined();
  });

  it("S11: success 后 1s 新 prompt：success → thinking；旧计时器不得覆盖新状态（generation）", () => {
    let r = step(initialFacts("s11"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "session-idle" }, 100);
    expect(r.visible).toBe("success");
    expect(r.generation).toBe(1);
    const staleTimer = { snapshot: r.transient, snapshotGen: r.generation }; // 旧回调持有的快照

    // 1s 后新 prompt → 活动开始事件清除瞬态
    r = step(r.facts, { type: "cycle-started" }, 1100, { transient: r.transient, generation: r.generation });
    expect(r.visible).toBe("thinking");
    expect(r.transient).toBeUndefined();
    expect(r.generation).toBe(2); // generation 递增 → 旧回调校验失败

    // 旧回调在 until 触发：generation 校验失败，不得覆盖为 success/idle
    const stale = reduceExpired(r.facts, { transient: staleTimer.snapshot, generation: staleTimer.snapshotGen }, 100 + SUCCESS_DURATION_MS);
    expect(stale.visible).toBe("thinking");
  });

  it("S12: 会话 A 收到会话 B 事件 → A 不变（两个独立实例，无共享状态）", () => {
    const a = initialFacts("A");
    const b = initialFacts("B");
    let rb = step(b, { type: "cycle-started" }, 0);
    rb = step(rb.facts, { type: "tool-started", callID: "x" }, 10);
    rb = step(rb.facts, { type: "permission-opened", requestID: "p" }, 20);
    expect(rb.visible).toBe("waiting");

    // A 实例完全不受影响（sessionID 分发由调用方负责，归约器实例间零共享）
    expect(a.cycleActive).toBe(false);
    expect(a.activeToolCallIDs.size).toBe(0);
    expect(a.pendingPermissionIDs.size).toBe(0);
    expect(reduceState(a)).toBe("idle");
  });

  it("S13: 重水合不继承瞬态：fresh 实例无 success/error 残留", () => {
    // 前一会话刚播放过 success，新会话从 API 重水合：不继承瞬态
    const fresh = initialFacts("C");
    expect(reduceExpired(fresh, { transient: undefined, generation: 0 }, 0).transient).toBeUndefined();
    // 重水合一个 idle 会话 → 不播放 success
    const idle = step(fresh, { type: "session-idle" }, 0);
    expect(idle.transient).toBeUndefined();
    expect(idle.visible).toBe("idle");
    // 重水合 busy → thinking，无瞬态
    const busy = step(initialFacts("C"), { type: "busy-started" }, 0);
    expect(busy.transient).toBeUndefined();
    expect(busy.visible).toBe("thinking");
  });

  it("S14: 重复 tool end / reply 幂等（含缺失 started 的结束）", () => {
    let r = step(initialFacts("s14"), { type: "tool-started", callID: "A" }, 0);
    r = step(r.facts, { type: "tool-ended", callID: "A" }, 10);
    // 重复移除：幂等，不崩溃
    r = step(r.facts, { type: "tool-ended", callID: "A" }, 20);
    expect(r.facts.activeToolCallIDs.size).toBe(0);
    // 无 cycle 事实 → 重新归约回 idle（不崩溃）
    expect(r.visible).toBe("idle");
    // 缺失 started 的结束：无操作
    r = step(r.facts, { type: "tool-ended", callID: "ghost" }, 30);
    expect(r.facts.activeToolCallIDs.size).toBe(0);
    // 重复 reply：幂等
    r = step(initialFacts("s14"), { type: "permission-opened", requestID: "p1" }, 0);
    r = step(r.facts, { type: "permission-closed", requestID: "p1" }, 10);
    r = step(r.facts, { type: "permission-closed", requestID: "p1" }, 20);
    expect(r.facts.pendingPermissionIDs.size).toBe(0);
    // 缺失 opened 的 close：无操作
    r = step(r.facts, { type: "question-closed", requestID: "ghost" }, 30);
    expect(r.facts.pendingQuestionIDs.size).toBe(0);
  });

  it("S15: reducer 纯函数无副作用：不可变更新，可安全 dispose（无全局状态/计时器/监听器）", () => {
    const f = initialFacts("s15");
    const f2 = reduceFacts(f, { type: "cycle-started" });
    // 不可变：返回新对象，输入不被修改
    expect(f2).not.toBe(f);
    expect(f.cycleActive).toBe(false);
    expect(f2.cycleActive).toBe(true);
    // 无隐式计时器：活动开始事件不产生瞬态
    const r = step(f2, { type: "tool-started", callID: "A" }, 0);
    expect(r.transient).toBeUndefined();
    // dispose 语义：丢弃实例即可，实例间零共享（可安全释放）
    const g = initialFacts("s15b");
    expect(reduceFacts(f2, { type: "session-idle" }).cycleActive).toBe(false);
    expect(g.cycleActive).toBe(false);
  });
});

describe("reducer 瞬态时序与 generation（docs/03 §5）", () => {
  it("瞬态过期后重新归约事实得出 visible，不无条件写 idle", () => {
    // error 播放期间 facts 仍有活动（如 waiting 事实），过期后应回到 waiting 而非 idle
    let r = step(initialFacts("t1"), { type: "tool-started", callID: "A" }, 0);
    r = step(r.facts, { type: "tool-ended", callID: "A", failed: true }, 10);
    expect(r.visible).toBe("error");
    // 过期时 facts 推导出 waiting（pending permission 仍在）
    const e = reduceExpired(r.facts, { transient: r.transient, generation: r.generation }, 10 + ERROR_DURATION_MS);
    expect(e.visible).toBe("idle"); // 无 pending → idle
    expect(e.transient).toBeUndefined();

    let w = step(initialFacts("t1"), { type: "permission-opened", requestID: "p1" }, 0);
    w = step(w.facts, { type: "tool-ended", callID: "ghost", failed: true }, 10);
    expect(w.visible).toBe("error");
    const ew = reduceExpired(w.facts, { transient: w.transient, generation: w.generation }, 10 + ERROR_DURATION_MS);
    expect(ew.visible).toBe("waiting"); // 重新归约 → waiting，不是无条件 idle
  });

  it("未到期瞬态继续显示：now < until → 保持 success/error", () => {
    let r = step(initialFacts("t2"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "session-idle" }, 100);
    const mid = reduceExpired(r.facts, { transient: r.transient, generation: r.generation }, 100 + SUCCESS_DURATION_MS - 1);
    expect(mid.visible).toBe("success");
    expect(mid.transient).toBeDefined();
  });

  it("success 播放中收到工具失败 → error 覆盖 success（generation 递增）", () => {
    let r = step(initialFacts("t3"), { type: "cycle-started" }, 0);
    r = step(r.facts, { type: "session-idle" }, 100);
    expect(r.visible).toBe("success");
    expect(r.generation).toBe(1);
    r = step(r.facts, { type: "tool-ended", callID: "ghost", failed: true }, 200, {
      transient: r.transient,
      generation: r.generation,
    });
    expect(r.visible).toBe("error");
    expect(r.transient?.until).toBe(200 + ERROR_DURATION_MS);
    expect(r.generation).toBe(2);
  });

  it("永久 retry 无法锁死状态：session-idle/busy 清除 retryActive", () => {
    let r = initialFacts("t4");
    for (let i = 0; i < 5; i++) {
      const next = step(r, { type: "retry-started" }, i * 10);
      r = next.facts;
      expect(next.visible).toBe("retry");
    }
    expect(reduceState(r)).toBe("retry");
    // status idle 复位 retryActive → 不锁死（该周期曾活跃 → 正常 success）
    const idle = step(r, { type: "session-idle" }, 100);
    expect(idle.facts.retryActive).toBe(false);
    expect(idle.facts.cycleActive).toBe(false);
    // 另一种路径：busy 复位
    const busy = step(r, { type: "busy-started" }, 100);
    expect(busy.facts.retryActive).toBe(false);
    expect(busy.visible).toBe("thinking");
  });
});
