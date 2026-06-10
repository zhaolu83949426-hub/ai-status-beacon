import { useEffect, useMemo, useState } from "react";
import type { AgentMetadata, AgentSettings, AppSettings, HookSyncResult } from "../../../../shared/types";

type HookStatus = HookSyncResult["hookStatus"] | "unknown";

const AGENT_ORDER = [
  "claude-code",
  "codex",
  "gemini-cli",
  "kimi-cli",
  "qwen-code",
  "opencode",
  "codebuddy",
  "qoder",
  "antigravity-cli",
  "cursor-agent",
  "copilot-cli",
  "kiro-cli",
  "pi",
  "openclaw",
  "hermes",
];

const HOOK_LABELS: Record<HookStatus, string> = {
  synced: "已同步",
  missing: "未配置",
  outdated: "需更新",
  unsupported: "不支持",
  error: "错误",
  unknown: "未同步",
};

export function AgentsTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [metadata, setMetadata] = useState<AgentMetadata[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.beaconApi.listAgents()
      .then((list) => setMetadata(sortAgents(list)))
      .catch((err) => setError(String(err)));
  }, []);

  const agents = useMemo(
    () => (metadata ?? []).map((agent) => ({
      agent,
      settings: settings.agents[agent.id],
      hookStatus: (agent.hookStatus ?? "unknown") as HookStatus,
    })),
    [metadata, settings.agents],
  );

  const setAgentFlag = async (agentId: string, flag: keyof AgentSettings, value: boolean) => {
    const updated = await window.beaconApi.setAgentFlag(agentId, flag, value);
    onSave(updated);
  };

  if (error) return <div className="empty-state">加载 Agent 失败: {error}</div>;
  if (!metadata) return <div className="empty-state">加载中...</div>;

  return (
    <div className="section">
      <div className="section-title">Agent 管理</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>状态监控</th>
            <th>审批接管</th>
            <th>Hook</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(({ agent, settings: agentSettings, hookStatus: status }) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              stateEnabled={agentSettings.stateEnabled}
              permissionEnabled={agentSettings.permissionEnabled}
              hookStatus={status}
              onToggleState={() => setAgentFlag(agent.id, "stateEnabled", !agentSettings.stateEnabled)}
              onTogglePermission={() => setAgentFlag(agent.id, "permissionEnabled", !agentSettings.permissionEnabled)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentRow(props: {
  agent: AgentMetadata;
  stateEnabled: boolean;
  permissionEnabled: boolean;
  hookStatus: HookStatus;
  onToggleState: () => void;
  onTogglePermission: () => void;
}) {
  return (
    <tr>
      <td className="agent-cell">
        <div className="agent-name">{props.agent.name}</div>
        <AgentBadges agent={props.agent} />
      </td>
      <ToggleCell checked={props.stateEnabled} onChange={props.onToggleState} />
      <ToggleCell
        checked={props.permissionEnabled}
        disabled={!props.agent.capabilities.permission}
        onChange={props.onTogglePermission}
      />
      <td>
        <span className={`hook-status hook-${props.hookStatus}`}>
          {HOOK_LABELS[props.hookStatus]}
        </span>
      </td>
    </tr>
  );
}

function AgentBadges({ agent }: { agent: AgentMetadata }) {
  return (
    <div className="agent-badges">
      <span className={`agent-badge ${agent.installed ? "accent" : ""}`}>
        {agent.configPaths.length === 0 ? "无需配置" : agent.installed ? "已配置" : "未配置"}
      </span>
      {agent.capabilities.state && <span className="agent-badge">状态</span>}
      {agent.capabilities.permission && <span className="agent-badge accent">审批</span>}
    </div>
  );
}

function ToggleCell(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <td>
      <label className="toggle small">
        <input
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={props.onChange}
        />
        <span className="toggle-track" />
      </label>
    </td>
  );
}

function sortAgents(agents: AgentMetadata[]): AgentMetadata[] {
  return [...agents].sort((a, b) => {
    const priority = getAgentPriority(a.id) - getAgentPriority(b.id);
    if (priority !== 0) return priority;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function getAgentPriority(agentId: string): number {
  const index = AGENT_ORDER.indexOf(agentId);
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}
