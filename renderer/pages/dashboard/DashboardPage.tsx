import { useEffect, useState } from "react";
import type { DashboardSessionView, BeaconState } from "../../../shared/types";

const STATE_LABELS: Record<BeaconState, string> = {
  idle: "空闲",
  working: "工作中",
  approval: "等审批",
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
    <div className="dashboard-container">
      <div className="dashboard-title">Dashboard</div>
      <table className="dashboard-table">
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
              <td colSpan={6} style={{ textAlign: "center", color: "#71717a", padding: 40 }}>
                无活跃会话
              </td>
            </tr>
          )}
          {sessions.map((s, i) => (
            <tr key={`${s.agentId}-${i}`}>
              <td>{s.agentName}</td>
              <td>
                <span className={`state-badge state-${s.state}`}>
                  {STATE_LABELS[s.state]}
                </span>
              </td>
              <td>{s.lastEvent}</td>
              <td title={s.cwd} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.cwd || "—"}
              </td>
              <td>{formatTime(s.startedAt)}</td>
              <td>{formatTime(s.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
