import { useEffect, useState } from "react";
import type { DashboardSessionView, BeaconState } from "../../../shared/types";

const STATE_LABELS: Record<BeaconState, string> = {
  idle: "空闲",
  sleeping: "休眠",
  thinking: "思考中",
  working: "工作中",
  attention: "需关注",
  approval: "等审批",
  notification: "通知",
  juggling: "子任务",
  sweeping: "压缩中",
  carrying: "工作区",
  "codex-turn-end": "回合结束",
  error: "错误",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSessionView[]>([]);

  const refresh = () => {
    window.beaconApi.getDashboardSessions().then(setSessions);
  };

  useEffect(() => {
    refresh();
    const unsub = window.beaconApi.onBeaconSnapshot(() => refresh());
    const interval = setInterval(refresh, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <span className="dashboard-count">{sessions.length}</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>状态</th>
            <th>最近事件</th>
            <th>工作目录</th>
            <th>开始时间</th>
            <th>最后更新</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-state">
                无活跃会话
              </td>
            </tr>
          )}
          {sessions.map((s, i) => (
            <tr key={`${s.agentId}-${i}`}>
              <td className="agent-name">{s.agentName}</td>
              <td>
                <span className={`state-badge state-${s.state}`}>
                  {STATE_LABELS[s.state]}
                </span>
              </td>
              <td style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12 }}>
                {s.lastEvent}
              </td>
              <td title={s.cwd} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)", fontSize: 12, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                {s.cwd || "—"}
              </td>
              <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{formatTime(s.startedAt)}</td>
              <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{formatTime(s.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
