import { CSSProperties, useEffect, useRef, useState } from "react";
import type { BeaconSnapshot, BeaconState, StatusBarPlacement } from "../../../shared/types";
import { QuotaSlot } from "../../components/QuotaCircle";
import { NotificationBubbles } from "../../components/NotificationBubbles";
import notchPanel from "../../public/img/notch_panel1_tighter.png";

const STATE_COLORS: Record<BeaconState, string> = {
  idle: "#31d76b",
  sleeping: "#31d76b",
  "codex-turn-end": "#31d76b",
  thinking: "#ffd43b",
  working: "#ffd43b",
  attention: "#ffd43b",
  approval: "#ffd43b",
  notification: "#ffd43b",
  juggling: "#ffd43b",
  sweeping: "#ffd43b",
  carrying: "#ffd43b",
  error: "#ff3b30",
};

const STATE_LIGHTS: Record<BeaconState, string> = {
  idle: "green",
  sleeping: "green",
  "codex-turn-end": "green",
  thinking: "yellow",
  working: "yellow",
  attention: "yellow",
  approval: "yellow",
  notification: "yellow",
  juggling: "yellow",
  sweeping: "yellow",
  carrying: "yellow",
  error: "red",
};

interface StatusBarViewport {
  width: number;
  height: number;
}

export function StatusBar() {
  const [snapshot, setSnapshot] = useState<BeaconSnapshot | null>(null);
  const viewport = useStatusBarViewport();

  useEffect(() => {
    window.beaconApi.getBeaconSnapshot().then(setSnapshot);
    const unsub = window.beaconApi.onBeaconSnapshot(setSnapshot);
    return unsub;
  }, []);

  const [taskBlinking, setTaskBlinking] = useState(false);
  const prevStateRef = useRef<BeaconState | null>(null);

  // 从非空闲状态进入 idle 时触发绿灯闪烁 3 次
  useEffect(() => {
    if (!snapshot) return;
    const prev = prevStateRef.current;
    prevStateRef.current = snapshot.state;
    if (!isIdleLikeState(snapshot.state)) {
      setTaskBlinking(false);
      return undefined;
    }
    if (prev !== null && !isIdleLikeState(prev)) {
      setTaskBlinking(true);
      const timer = setTimeout(() => setTaskBlinking(false), 2400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [snapshot]);

  if (!snapshot) return null;

  const state = snapshot.state;
  const color = STATE_COLORS[state];
  const lightTone = STATE_LIGHTS[state];
  const isApproval = state === "approval" || state === "notification";
  const isWorkingLike = !isIdleLikeState(state) && state !== "error";
  const hasQuota = snapshot.quotaSlots.length > 0;
  const backgroundStyle = buildStatusBarBackgroundStyle(notchPanel, snapshot.placement.edge, viewport);

  return (
    <div className="status-bar-wrapper">
      <NotificationBubbles placement={snapshot.placement} />
      <div className={`status-bar edge-${snapshot.placement.edge}`}>
        <div className="status-bar-bg" style={backgroundStyle} />
        <div className="traffic-light">
          {snapshot.lightMode === "single" ? (
            <StatusLight tone={lightTone} color={color} active flashing={isApproval} taskBlinking={taskBlinking} />
          ) : (
            <div className="triple-lights">
              <StatusLight tone="red" color={STATE_COLORS.error} active={state === "error"} />
              <StatusLight
                tone="yellow"
                color={STATE_COLORS.working}
                active={isWorkingLike}
                flashing={isApproval}
              />
              <StatusLight tone="green" color={STATE_COLORS.idle} active={isIdleLikeState(state)} taskBlinking={taskBlinking} />
            </div>
          )}
        </div>
        {hasQuota && (
          <div className="quota-area">
            {snapshot.quotaSlots.map((slot, index) => (
              <QuotaSlot
                key={`${slot.accountId}-${index}`}
                accountType={slot.accountType}
                tiers={slot.tiers}
                size={34}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function isIdleLikeState(state: BeaconState): boolean {
  return state === "idle" || state === "sleeping" || state === "codex-turn-end";
}

function useStatusBarViewport(): StatusBarViewport {
  const [viewport, setViewport] = useState<StatusBarViewport>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}

function buildStatusBarBackgroundStyle(
  image: string,
  edge: StatusBarPlacement["edge"],
  viewport: StatusBarViewport,
): CSSProperties {
  const isHorizontal = edge === "top" || edge === "bottom";
  const shortAxis = isHorizontal ? 52 : 64;

  // 黑色底图只允许中段延展，避免整张图被上下压缩后失真。
  if (edge === "left" || edge === "right") {
    return {
      "--status-bar-image": `url(${image})`,
      width: `${Math.max(viewport.height - shortAxis, 0)}px`,
      height: "0",
      transform: "translate(-50%, -50%) rotate(90deg)",
    } as CSSProperties;
  }

  return {
    "--status-bar-image": `url(${image})`,
    width: `${Math.max(viewport.width - shortAxis, 0)}px`,
    height: "0",
    transform: "translate(-50%, -50%)",
  } as CSSProperties;
}

function StatusLight({
  tone,
  color,
  active,
  flashing,
  taskBlinking,
}: {
  tone: string;
  color: string;
  active: boolean;
  flashing?: boolean;
  taskBlinking?: boolean;
}) {
  return (
    <div
      className={`light light-${tone} ${active ? "active" : "inactive"} ${flashing ? "flashing" : ""} ${taskBlinking ? "task-complete-blink" : ""}`}
      style={{ "--light-color": color } as CSSProperties}
    />
  );
}
