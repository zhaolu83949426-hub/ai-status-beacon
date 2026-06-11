import { useEffect, useRef, useState, useCallback } from "react";
import type { NotificationBubble, StatusBarPlacement } from "../../../shared/types";

const AUTO_CLOSE_MS = 6000;
const FADE_OUT_MS = 400;
const MAX_BUBBLES = 5;

const TOOL_PILL_COLORS: Record<string, string> = {
  Bash: "#e74c3c",
  Edit: "#3498db",
  Write: "#3498db",
  Read: "#27ae60",
  Glob: "#8e44ad",
  Grep: "#8e44ad",
  MultiEdit: "#3498db",
  NotebookEdit: "#e67e22",
};

const EVENT_LABELS: Record<string, string> = {
  PreToolUse: "准备执行",
  PostToolUse: "已执行",
  PostToolUseFailure: "执行失败",
  PermissionRequest: "请求审批",
  UserPromptSubmit: "开始思考",
  SessionStart: "会话开始",
  Stop: "已停止",
};

export function NotificationBubbles({ placement }: { placement: StatusBarPlacement }) {
  const [bubbles, setBubbles] = useState<NotificationBubble[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeBubble = useCallback((id: string) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const unsub = window.beaconApi.onNotificationBubble((bubble) => {
      setBubbles((prev) => {
        const next = [...prev, bubble];
        return next.slice(-MAX_BUBBLES);
      });
      const t = setTimeout(() => removeBubble(bubble.id), AUTO_CLOSE_MS);
      timers.current.set(bubble.id, t);
    });
    return unsub;
  }, [removeBubble]);

  const edge = placement.edge;
  const isHorizontal = edge === "top" || edge === "bottom";

  return (
    <div className={`bubble-stack ${isHorizontal ? "bubble-horizontal" : "bubble-vertical"} bubble-${edge}`}>
      {bubbles.map((b, i) => (
        <BubbleCard key={b.id} bubble={b} index={i} onDismiss={() => removeBubble(b.id)} />
      ))}
    </div>
  );
}

function BubbleCard({ bubble, index, onDismiss }: { bubble: NotificationBubble; index: number; onDismiss: () => void }) {
  const [hiding, setHiding] = useState(false);
  const pillColor = TOOL_PILL_COLORS[bubble.toolName ?? ""] ?? "#607187";
  const eventLabel = EVENT_LABELS[bubble.event] ?? bubble.event;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setHiding(true), AUTO_CLOSE_MS - FADE_OUT_MS);
    return () => clearTimeout(fadeTimer);
  }, []);

  return (
    <div
      className={`bubble-card ${hiding ? "bubble-hiding" : ""}`}
      style={{ "--bubble-index": index } as React.CSSProperties}
      onClick={onDismiss}
    >
      <div className="bubble-header">
        <span className="bubble-agent">{bubble.agentName}</span>
        <span className="bubble-event">{eventLabel}</span>
      </div>
      {bubble.toolName && (
        <div className="bubble-tool-row">
          <span className="bubble-tool-pill" style={{ "--pill-color": pillColor } as React.CSSProperties}>
            {bubble.toolName}
          </span>
        </div>
      )}
      {bubble.cwd && (
        <div className="bubble-cwd" title={bubble.cwd}>
          {shortenCwd(bubble.cwd)}
        </div>
      )}
    </div>
  );
}

function shortenCwd(cwd: string): string {
  const home = "";
  if (home && cwd.startsWith(home)) {
    return "~" + cwd.slice(home.length);
  }
  const parts = cwd.replace(/\\/g, "/").split("/");
  if (parts.length <= 3) return cwd;
  return ".../" + parts.slice(-2).join("/");
}
