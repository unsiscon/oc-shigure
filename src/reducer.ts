// opco-shigure 状态归约器（todo 3 交付物）。
//
// 纯函数：无计时器、无 UI、不读真实时钟——`now` 由调用方注入。
// 生产环境调用方必须传单调时钟（performance.now()/process.hrtime），禁止 Date.now()
// （docs/03:112：success/error 计时以 monotonic time 为依据）；测试注入 fake clock。
//
// 职责分工：
// - reduceFacts：事件 → 会话局部事实（docs/03 §2）
// - reduceState：事实 → 可见状态（docs/03 §3 优先级 waiting>retry>working>thinking>idle）
// - reduceStep：事件驱动归约 + 瞬态（success/error）调度决策（docs/03 §5）
// - reduceExpired：过期回调（generation 校验 + 重新归约得出 visible）
//
// generation token（docs/03 §5）：每次创建/清除瞬态时 +1；异步过期回调携带旧代数，
// 校验失败则丢弃，防止旧回调覆盖新状态。代数由调用方持有（TransientState.generation），
// 在瞬态被清除后仍单调递增，避免「清除→重建」后代数回退导致旧回调误通过校验。
import type { PetEvent, PetState } from "./types";

/** 会话局部事实（docs/03 §2）。 */
export interface SessionPetFacts {
  sessionID: string;
  cycleActive: boolean;
  reasoningActive: boolean;
  textActive: boolean;
  activeToolCallIDs: Set<string>;
  pendingPermissionIDs: Set<string>;
  pendingQuestionIDs: Set<string>;
  retryActive: boolean;
  lastTerminalOutcome?: "success" | "error" | "aborted";
}

export type TransientKind = "success" | "error";

/** 带期限的瞬态结果（docs/03 §5）。generation 为该瞬态创建时的代数。 */
export interface Transient {
  kind: TransientKind;
  until: number;
  generation: number;
}

/** 调用方持有的瞬态状态：代数独立于瞬态对象，清除后仍单调递增。 */
export interface TransientState {
  transient?: Transient;
  generation: number;
}

export interface ReduceStepResult {
  facts: SessionPetFacts;
  visible: PetState;
  transient?: Transient;
  /** 单调递增代数：创建/清除瞬态时 +1，过期回调据此校验（docs/03 §5）。 */
  generation: number;
}

export const SUCCESS_DURATION_MS = 2500;
export const ERROR_DURATION_MS = 4000;

/** 活动开始事件：立即打断 success/error 结果动画（docs/03 §3/§5）。 */
const ACTIVITY_START_EVENTS = new Set<PetEvent["type"]>([
  "cycle-started",
  "busy-started",
  "reasoning-started",
  "text-started",
  "tool-started",
  "permission-opened",
  "question-opened",
  "retry-started",
]);

export function initialFacts(sessionID: string): SessionPetFacts {
  return {
    sessionID,
    cycleActive: false,
    reasoningActive: false,
    textActive: false,
    activeToolCallIDs: new Set(),
    pendingPermissionIDs: new Set(),
    pendingQuestionIDs: new Set(),
    retryActive: false,
  };
}

/**
 * 事件 → 事实（不可变更新，输入不被修改）。
 * - session-idle 的成功判定在 reduceStep（基于归约前 cycleActive）；此处仅复位事实，
 *   并把 cycleActive 置 false，防止幽灵 idle 重复触发 success（破坏 S01/S11）。
 * - retryActive 复位点：session.status idle/busy（session-idle/busy-started），
 *   保证永久 retry 事件无法锁死状态（docs/03:72,111）。
 * - cycle-started（新 prompt）不清除 retryActive：新用户任务只打断结果动画（docs/03 "retry
 *   持续到对应事实消失"），retry 期间新 prompt 仍显示 retry 直到 status busy/idle。
 */
export function reduceFacts(facts: SessionPetFacts, event: PetEvent): SessionPetFacts {
  const next: SessionPetFacts = {
    ...facts,
    activeToolCallIDs: new Set(facts.activeToolCallIDs),
    pendingPermissionIDs: new Set(facts.pendingPermissionIDs),
    pendingQuestionIDs: new Set(facts.pendingQuestionIDs),
  };

  switch (event.type) {
    case "cycle-started":
      next.cycleActive = true;
      next.lastTerminalOutcome = undefined;
      break;
    case "busy-started":
      next.cycleActive = true;
      next.retryActive = false;
      break;
    case "retry-started":
      next.retryActive = true;
      next.cycleActive = true;
      break;
    case "reasoning-started":
      next.reasoningActive = true;
      break;
    case "reasoning-ended":
      next.reasoningActive = false;
      break;
    case "text-started":
      next.textActive = true;
      break;
    case "text-ended":
      next.textActive = false;
      break;
    case "tool-started":
      next.activeToolCallIDs.add(event.callID);
      break;
    case "tool-ended":
      // 幂等：重复/缺失 started 的结束事件移除无操作（docs/03 §6）
      next.activeToolCallIDs.delete(event.callID);
      break;
    case "permission-opened":
      next.pendingPermissionIDs.add(event.requestID);
      break;
    case "permission-closed":
      next.pendingPermissionIDs.delete(event.requestID);
      break;
    case "question-opened":
      next.pendingQuestionIDs.add(event.requestID);
      break;
    case "question-closed":
      next.pendingQuestionIDs.delete(event.requestID);
      break;
    case "session-idle":
      // 清空活动集合，防止幽灵 callID/pending 永久锁住 working/waiting（docs/03 §6）
      next.cycleActive = false;
      next.reasoningActive = false;
      next.textActive = false;
      next.activeToolCallIDs.clear();
      next.pendingPermissionIDs.clear();
      next.pendingQuestionIDs.clear();
      next.retryActive = false;
      next.lastTerminalOutcome = "success";
      break;
    case "cycle-failed":
      resetActive(next);
      next.lastTerminalOutcome = "error";
      break;
    case "cycle-aborted":
      resetActive(next);
      next.lastTerminalOutcome = "aborted";
      break;
  }
  return next;
}

function resetActive(f: SessionPetFacts): void {
  f.cycleActive = false;
  f.reasoningActive = false;
  f.textActive = false;
  f.activeToolCallIDs.clear();
  f.pendingPermissionIDs.clear();
  f.pendingQuestionIDs.clear();
  f.retryActive = false;
}

/**
 * 事实 → 可见状态（docs/03 §3）：waiting > retry > working > thinking > idle。
 * success/error 是带期限的瞬态（由 reduceStep/reduceExpired 决定），不是持久事实。
 */
export function reduceState(facts: SessionPetFacts): PetState {
  if (facts.pendingPermissionIDs.size > 0 || facts.pendingQuestionIDs.size > 0) {
    return "waiting";
  }
  if (facts.retryActive) {
    return "retry";
  }
  if (facts.activeToolCallIDs.size > 0) {
    return "working";
  }
  if (facts.reasoningActive || facts.textActive || facts.cycleActive) {
    return "thinking";
  }
  return "idle";
}

/**
 * 事件驱动归约 + 瞬态调度决策（docs/03 §5）。
 * `now` 由调用方注入（单调时钟）。`current` 为调用方当前瞬态状态（代数 + 可选瞬态）。
 *
 * 规则：
 * 1. 成功判定：session-idle 且归约前 cycleActive 为真 → success（until=now+2500），
 *    不要求 step.ended 前置（docs/03:76）。
 * 2. cycle-failed → error（until=now+4000，完整 4s）。
 * 3. tool-ended.failed → error（until=now+4000，短暂可打断错误，docs/03:80）。
 * 4. 活动开始事件（及用户中断 cycle-aborted）→ 清除当前瞬态，generation++。
 * 5. 其余事件携带未过期瞬态；当前瞬态已过期（now>=until）→ 丢弃并重新归约事实
 *    得出 visible，不无条件写 idle。
 */
export function reduceStep(
  facts: SessionPetFacts,
  event: PetEvent,
  now: number,
  current: TransientState = { generation: 0 },
): ReduceStepResult {
  const wasCycleActive = facts.cycleActive;
  const nextFacts = reduceFacts(facts, event);

  // 1) 当前瞬态过期 → 丢弃；generation 不变（docs/03:112：过期后重新归约，非无条件写 idle）
  let generation = current.generation;
  let carried: Transient | undefined = current.transient;
  if (carried && now >= carried.until) {
    carried = undefined;
  }

  // 2) 终端事件创建新瞬态（覆盖任何旧瞬态；新 cycle/waiting/retry 可立即打断，docs/03:52,105）
  if (event.type === "session-idle" && wasCycleActive) {
    return transientResult(nextFacts, "success", now + SUCCESS_DURATION_MS, generation + 1);
  }
  if (event.type === "cycle-failed") {
    return transientResult(nextFacts, "error", now + ERROR_DURATION_MS, generation + 1);
  }
  if (event.type === "tool-ended" && event.failed) {
    return transientResult(nextFacts, "error", now + ERROR_DURATION_MS, generation + 1);
  }

  // 3) 活动开始事件 / 用户中断 → 清除当前瞬态（generation++，docs/03 §5）
  if (ACTIVITY_START_EVENTS.has(event.type) || event.type === "cycle-aborted") {
    const cleared = carried !== undefined;
    return {
      facts: nextFacts,
      visible: reduceState(nextFacts),
      transient: undefined,
      generation: cleared ? generation + 1 : generation,
    };
  }

  // 4) 其余事件：携带未过期的当前瞬态
  return {
    facts: nextFacts,
    visible: carried ? carried.kind : reduceState(nextFacts),
    transient: carried,
    generation,
  };
}

/**
 * 过期回调路径（纯函数）：调用方计时器到点后调用。
 * - generation 校验：旧回调代数与瞬态代数不一致 → 丢弃（防旧回调覆盖新状态，docs/03 §5）。
 * - 未到期 → 继续显示瞬态；到期 → 重新归约事实得出 visible，不无条件写 idle。
 */
export function reduceExpired(
  facts: SessionPetFacts,
  current: TransientState,
  now: number,
): Omit<ReduceStepResult, "facts"> {
  const { transient, generation } = current;
  if (!transient || generation !== transient.generation) {
    // 无瞬态或回调已失效：以当前事实归约，不写瞬态
    return { visible: reduceState(facts), transient: undefined, generation };
  }
  if (now < transient.until) {
    return { visible: transient.kind, transient, generation };
  }
  return { visible: reduceState(facts), transient: undefined, generation };
}

function transientResult(
  facts: SessionPetFacts,
  kind: TransientKind,
  until: number,
  generation: number,
): ReduceStepResult {
  const transient: Transient = { kind, until, generation };
  return { facts, visible: kind, transient, generation };
}
