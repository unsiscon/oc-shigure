// todo 2：SDK 事件适配器。
// 把 @opencode-ai/sdk v2 的 Event 联合映射为 PetEvent（仅按 allowlist，不解析事件正文/delta 文本）。
import type { Event } from "@opencode-ai/sdk/v2";
import type { PetEvent } from "./types";

function propsOf(event: Event): Record<string, unknown> {
  return event.properties as Record<string, unknown>;
}

/**
 * 按 allowlist 把 SDK Event 映射为 PetEvent；未列出的类型一律返回 null（忽略，不改变可信状态）。
 * 绝不抛错：session.error 的 sessionID/error 均可选，判定一律用 error?.name 可选链守卫。
 */
export function mapEvent(event: Event): PetEvent | null {
  const props = propsOf(event);

  switch (event.type) {
    case "session.next.step.started":
    case "session.next.prompted":
    case "session.next.prompt.admitted":
      return { type: "cycle-started" };
    case "session.next.reasoning.started":
      return { type: "reasoning-started" };
    case "session.next.reasoning.ended":
      return { type: "reasoning-ended" };
    case "session.next.text.started":
      return { type: "text-started" };
    case "session.next.text.ended":
      return { type: "text-ended" };
    case "session.next.tool.input.started":
    case "session.next.tool.called":
    case "session.next.shell.started":
      return { type: "tool-started", callID: props.callID as string };
    case "session.next.tool.success":
    case "session.next.shell.ended":
      return { type: "tool-ended", callID: props.callID as string };
    case "session.next.tool.failed":
      return { type: "tool-ended", callID: props.callID as string, failed: true };
    // 显式忽略：输入流结束 ≠ 执行结束（tool.input.ended 落入 default → null）
    case "session.next.retried":
      return { type: "retry-started" };
    case "session.next.step.failed":
      return { type: "cycle-failed" };
    case "permission.asked":
    case "permission.v2.asked":
      return { type: "permission-opened", requestID: props.id as string };
    case "permission.replied":
    case "permission.v2.replied":
      return { type: "permission-closed", requestID: props.requestID as string };
    case "question.asked":
    case "question.v2.asked":
      return { type: "question-opened", requestID: props.id as string };
    case "question.replied":
    case "question.rejected":
    case "question.v2.replied":
    case "question.v2.rejected":
      return { type: "question-closed", requestID: props.requestID as string };
    case "session.status": {
      const status = props.status as { type?: string } | undefined;
      if (status?.type === "retry") return { type: "retry-started" };
      if (status?.type === "busy") return { type: "busy-started" };
      if (status?.type === "idle") return { type: "session-idle" };
      return null;
    }
    case "session.idle":
      return { type: "session-idle" };
    case "session.error": {
      const error = props.error as { name?: string } | undefined;
      // error 缺失按 cycle-failed 处理；仅按 error.name 判定，不匹配错误文本字符串。
      return error?.name === "MessageAbortedError"
        ? { type: "cycle-aborted" }
        : { type: "cycle-failed" };
    }
    default:
      // delta / tool.progress / message.part.* / session.next.tool.input.ended / 其余未声明类型
      return null;
  }
}

/**
 * 返回包装器：丢弃 sessionID 不匹配的事件。
 * 无 sessionID 的事件（如 session.error 缺省 sessionID）无法按会话过滤，
 * 放行交由下游 registry 路由（todo 8），绝不抛错。
 */
export function filterForSession(sessionID: string): (event: Event) => boolean {
  return (event) => {
    const eventSessionID = propsOf(event).sessionID;
    return typeof eventSessionID !== "string" || eventSessionID === sessionID;
  };
}
