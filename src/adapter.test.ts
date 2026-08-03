// todo 2：SDK 事件适配器（TDD）。测试构造 SDK 形状的最小事件对象 {id, type, properties}。
import { describe, expect, it } from "vitest";
import type { Event } from "@opencode-ai/sdk/v2";
import { filterForSession, mapEvent } from "./adapter";

/** 构造 SDK 形状的最小事件对象（仅 id/type/properties，properties 按需最小）。 */
function ev(type: string, properties: Record<string, unknown>, id = "evt-1"): Event {
  return { id, type, properties } as Event;
}

describe("mapEvent: 周期类", () => {
  it("session.next.step.started → cycle-started", () => {
    expect(mapEvent(ev("session.next.step.started", { sessionID: "s1", assistantMessageID: "m1" }))).toEqual({
      type: "cycle-started",
    });
  });

  it("session.next.prompted → cycle-started", () => {
    expect(mapEvent(ev("session.next.prompted", { sessionID: "s1", messageID: "m1", prompt: {} }))).toEqual({
      type: "cycle-started",
    });
  });

  it("session.next.prompt.admitted → cycle-started", () => {
    expect(mapEvent(ev("session.next.prompt.admitted", { sessionID: "s1", messageID: "m1", prompt: {} }))).toEqual({
      type: "cycle-started",
    });
  });
});

describe("mapEvent: 推理/文本类", () => {
  it("session.next.reasoning.started → reasoning-started", () => {
    expect(mapEvent(ev("session.next.reasoning.started", { sessionID: "s1", reasoningID: "r1" }))).toEqual({
      type: "reasoning-started",
    });
  });

  it("session.next.reasoning.ended → reasoning-ended", () => {
    expect(mapEvent(ev("session.next.reasoning.ended", { sessionID: "s1", reasoningID: "r1", text: "" }))).toEqual({
      type: "reasoning-ended",
    });
  });

  it("session.next.text.started → text-started", () => {
    expect(mapEvent(ev("session.next.text.started", { sessionID: "s1", textID: "t1" }))).toEqual({
      type: "text-started",
    });
  });

  it("session.next.text.ended → text-ended", () => {
    expect(mapEvent(ev("session.next.text.ended", { sessionID: "s1", textID: "t1", text: "hi" }))).toEqual({
      type: "text-ended",
    });
  });
});

describe("mapEvent: 工具类", () => {
  it("session.next.tool.input.started → tool-started（callID）", () => {
    expect(mapEvent(ev("session.next.tool.input.started", { sessionID: "s1", callID: "c1", name: "read" }))).toEqual({
      type: "tool-started",
      callID: "c1",
    });
  });

  it("session.next.tool.called → tool-started（callID）", () => {
    expect(mapEvent(ev("session.next.tool.called", { sessionID: "s1", callID: "c2", tool: "bash", input: {} }))).toEqual({
      type: "tool-started",
      callID: "c2",
    });
  });

  it("session.next.shell.started → tool-started（callID）", () => {
    expect(mapEvent(ev("session.next.shell.started", { sessionID: "s1", callID: "c3", command: "ls" }))).toEqual({
      type: "tool-started",
      callID: "c3",
    });
  });

  it("session.next.tool.success → tool-ended（callID）", () => {
    expect(mapEvent(ev("session.next.tool.success", { sessionID: "s1", callID: "c4", content: [] }))).toEqual({
      type: "tool-ended",
      callID: "c4",
    });
  });

  it("session.next.shell.ended → tool-ended（callID）", () => {
    expect(mapEvent(ev("session.next.shell.ended", { sessionID: "s1", callID: "c5", output: "" }))).toEqual({
      type: "tool-ended",
      callID: "c5",
    });
  });

  it("session.next.tool.failed → tool-ended（callID, failed:true）", () => {
    expect(mapEvent(ev("session.next.tool.failed", { sessionID: "s1", callID: "c6", error: { name: "x" } }))).toEqual({
      type: "tool-ended",
      callID: "c6",
      failed: true,
    });
  });

  it("session.next.tool.input.ended → null（输入流结束 ≠ 执行结束）", () => {
    expect(mapEvent(ev("session.next.tool.input.ended", { sessionID: "s1", callID: "c7", text: "" }))).toBeNull();
  });
});

describe("mapEvent: 权限类（v1/v2 归一）", () => {
  it("permission.asked（id）→ permission-opened（requestID=id）", () => {
    expect(mapEvent(ev("permission.asked", { id: "perm-1", sessionID: "s1", permission: "bash", patterns: [] }))).toEqual(
      { type: "permission-opened", requestID: "perm-1" },
    );
  });

  it("permission.v2.asked（id）→ permission-opened（requestID=id）", () => {
    expect(mapEvent(ev("permission.v2.asked", { id: "perm-2", sessionID: "s1", action: "bash", resources: [] }))).toEqual(
      { type: "permission-opened", requestID: "perm-2" },
    );
  });

  it("permission.replied（requestID）→ permission-closed（requestID）", () => {
    expect(mapEvent(ev("permission.replied", { sessionID: "s1", requestID: "req-1", reply: "once" }))).toEqual({
      type: "permission-closed",
      requestID: "req-1",
    });
  });

  it("permission.v2.replied（requestID）→ permission-closed（requestID）", () => {
    expect(mapEvent(ev("permission.v2.replied", { sessionID: "s1", requestID: "req-2", reply: "allow" }))).toEqual({
      type: "permission-closed",
      requestID: "req-2",
    });
  });
});

describe("mapEvent: 提问类（v1/v2 归一）", () => {
  it("question.asked（id）→ question-opened（requestID=id）", () => {
    expect(mapEvent(ev("question.asked", { id: "q-1", sessionID: "s1", questions: [] }))).toEqual({
      type: "question-opened",
      requestID: "q-1",
    });
  });

  it("question.v2.asked（id）→ question-opened（requestID=id）", () => {
    expect(mapEvent(ev("question.v2.asked", { id: "q-2", sessionID: "s1", questions: [] }))).toEqual({
      type: "question-opened",
      requestID: "q-2",
    });
  });

  it("question.replied（requestID）→ question-closed", () => {
    expect(mapEvent(ev("question.replied", { sessionID: "s1", requestID: "req-1", answers: [] }))).toEqual({
      type: "question-closed",
      requestID: "req-1",
    });
  });

  it("question.rejected（requestID）→ question-closed", () => {
    expect(mapEvent(ev("question.rejected", { sessionID: "s1", requestID: "req-2" }))).toEqual({
      type: "question-closed",
      requestID: "req-2",
    });
  });

  it("question.v2.replied（requestID）→ question-closed", () => {
    expect(mapEvent(ev("question.v2.replied", { sessionID: "s1", requestID: "req-3", answers: [] }))).toEqual({
      type: "question-closed",
      requestID: "req-3",
    });
  });

  it("question.v2.rejected（requestID）→ question-closed", () => {
    expect(mapEvent(ev("question.v2.rejected", { sessionID: "s1", requestID: "req-4" }))).toEqual({
      type: "question-closed",
      requestID: "req-4",
    });
  });
});

describe("mapEvent: session.status / idle / retried", () => {
  it("session.status type=retry → retry-started", () => {
    expect(mapEvent(ev("session.status", { sessionID: "s1", status: { type: "retry", attempt: 1, message: "m", next: 0 } }))).toEqual(
      { type: "retry-started" },
    );
  });

  it("session.status type=busy → busy-started", () => {
    expect(mapEvent(ev("session.status", { sessionID: "s1", status: { type: "busy" } }))).toEqual({ type: "busy-started" });
  });

  it("session.status type=idle → session-idle", () => {
    expect(mapEvent(ev("session.status", { sessionID: "s1", status: { type: "idle" } }))).toEqual({ type: "session-idle" });
  });

  it("session.next.retried（含 sessionID）→ retry-started 且返回非 null", () => {
    const result = mapEvent(
      ev("session.next.retried", { sessionID: "s1", attempt: 1, error: { name: "SessionNextRetryError" } }),
    );
    expect(result).not.toBeNull();
    expect(result).toEqual({ type: "retry-started" });
  });

  it("session.idle → session-idle", () => {
    expect(mapEvent(ev("session.idle", { sessionID: "s1" }))).toEqual({ type: "session-idle" });
  });
});

describe("mapEvent: 失败/中断类", () => {
  it("session.next.step.failed → cycle-failed", () => {
    expect(mapEvent(ev("session.next.step.failed", { sessionID: "s1", assistantMessageID: "m1", error: { name: "x" } }))).toEqual(
      { type: "cycle-failed" },
    );
  });

  it("session.error（非 MessageAbortedError）→ cycle-failed", () => {
    expect(mapEvent(ev("session.error", { sessionID: "s1", error: { name: "APIError" } }))).toEqual({ type: "cycle-failed" });
  });

  it("session.error 且 error.name=MessageAbortedError → cycle-aborted", () => {
    expect(mapEvent(ev("session.error", { sessionID: "s1", error: { name: "MessageAbortedError" } }))).toEqual({
      type: "cycle-aborted",
    });
  });

  it("session.error 无 error 字段 → cycle-failed 且不抛错", () => {
    expect(mapEvent(ev("session.error", { sessionID: "s1" }))).toEqual({ type: "cycle-failed" });
  });

  it("session.error missing sessionID 且无 error → 不抛错、按归属规则处理（cycle-failed）", () => {
    expect(() => mapEvent(ev("session.error", {}))).not.toThrow();
    expect(mapEvent(ev("session.error", {}))).toEqual({ type: "cycle-failed" });
  });
});

describe("mapEvent: 明确 allowlist（未列出的 → null）", () => {
  const nullCases: Array<[string, Record<string, unknown>]> = [
    ["session.next.text.delta", { sessionID: "s1", textID: "t1", delta: "x" }],
    ["session.next.reasoning.delta", { sessionID: "s1", reasoningID: "r1", delta: "x" }],
    ["session.next.tool.input.delta", { sessionID: "s1", callID: "c1", delta: "x" }],
    ["session.next.tool.progress", { sessionID: "s1", callID: "c1", structured: {}, content: [] }],
    ["message.part.updated", { sessionID: "s1", part: {} }],
    ["message.part.delta", { sessionID: "s1", messageID: "m1", partID: "p1", field: "text", delta: "x" }],
    ["session.next.step.ended", { sessionID: "s1", assistantMessageID: "m1", finish: "done", cost: 0, tokens: {} }],
    ["session.next.compaction.started", { sessionID: "s1", messageID: "m1", reason: "auto" }],
    ["session.next.agent.switched", { sessionID: "s1", messageID: "m1", agent: "build" }],
    ["session.created", { sessionID: "s1", info: {} }],
    ["message.updated", { sessionID: "s1", info: {} }],
    ["permission.replied-unknown", {}],
  ];

  it.each(nullCases)("未列出的 %s → null", (type, properties) => {
    expect(mapEvent(ev(type, properties))).toBeNull();
  });

  it("未知事件类型（未声明）→ null 且不抛错", () => {
    expect(() => mapEvent(ev("totally.unknown.event", { sessionID: "s1" }))).not.toThrow();
    expect(mapEvent(ev("totally.unknown.event", { sessionID: "s1" }))).toBeNull();
  });
});

describe("filterForSession", () => {
  it("sessionID 匹配 → true", () => {
    const keep = filterForSession("s1");
    expect(keep(ev("session.next.text.started", { sessionID: "s1", textID: "t1" }))).toBe(true);
  });

  it("sessionID 不匹配 → false（丢弃）", () => {
    const keep = filterForSession("s1");
    expect(keep(ev("session.next.text.started", { sessionID: "other", textID: "t1" }))).toBe(false);
  });

  it("retried 事件按 sessionID 正确过滤分发", () => {
    const keep = filterForSession("s1");
    expect(keep(ev("session.next.retried", { sessionID: "s1", attempt: 1, error: {} }))).toBe(true);
    expect(keep(ev("session.next.retried", { sessionID: "s2", attempt: 1, error: {} }))).toBe(false);
  });

  it("missing sessionID 的事件不抛错（放行，交由下游 registry 路由）", () => {
    const keep = filterForSession("s1");
    expect(() => keep(ev("session.error", {}))).not.toThrow();
    expect(keep(ev("session.error", {}))).toBe(true);
    expect(() => keep(ev("file.edited", { file: "a.txt" }))).not.toThrow();
  });
});
