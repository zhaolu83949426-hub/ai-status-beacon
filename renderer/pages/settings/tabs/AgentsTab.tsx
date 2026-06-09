import { useEffect, useState } from "react";
import type { AppSettings, HookSyncResult } from "../../../../shared/types";
import type { AgentDescriptor } from "../../../../shared/agent-types";

interface AgentInfo {
  id: string;
  name: string;
  installed: boolean;
  hookStatus: string;
  stateEnabled: boolean;
  permissionEnabled: boolean;
  capabilities: { state: boolean; permission: boolean };
}

export function AgentsTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    // Fetch agent info from settings + hardcoded list
    // In a real app this would come from IPC; here we infer from settings keys
    const agentSettings = settings.agents;
    const knownAgents: AgentInfo[] = Object.entries(agentSettings).map(([id, s]) => ({
      id,
      name: id, // name resolved from registry on main side
      installed: true,
      hookStatus: "unknown",
      stateEnabled: s.stateEnabled,
      permissionEnabled: s.permissionEnabled,
      capabilities: { state: true, permission: s.permissionEnabled },
    }));
    setAgents(knownAgents);
  }, [settings]);

  const toggleState = (agentId: string) => {
    const updated = { ...settings.agents };
    updated[agentId] = { ...updated[agentId], stateEnabled: !updated[agentId].stateEnabled };
    onSave({ ...settings, agents: updated });
  };

  const togglePermission = (agentId: string) => {
    const updated = { ...settings.agents };
    updated[agentId] = { ...updated[agentId], permissionEnabled: !updated[agentId].permissionEnabled };
    onSave({ ...settings, agents: updated });
  };

  const syncHook = async (agentId: string) => {
    setSyncing(agentId);
    try {
      const result = await window.beaconApi.syncAgentHook(agentId);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, hookStatus: result.hookStatus, installed: result.installed }
            : a,
        ),
      );
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="settings-section">
      <table className="settings-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>状态监控</th>
            <th>审批接管</th>
            <th>Hook</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <td className="agent-name">{agent.name}</td>
              <td>
                <label className="settings-toggle small">
                  <input
                    type="checkbox"
                    checked={agent.stateEnabled}
                    onChange={() => toggleState(agent.id)}
                  />
                  <span className="toggle-slider" />
                </label>
              </td>
              <td>
                <label className="settings-toggle small">
                  <input
                    type="checkbox"
                    checked={agent.permissionEnabled}
                    onChange={() => togglePermission(agent.id)}
                    disabled={!agent.capabilities.permission}
                  />
                  <span className="toggle-slider" />
                </label>
              </td>
              <td>
                <span className={`hook-status hook-${agent.hookStatus}`}>
                  {agent.hookStatus}
                </span>
              </td>
              <td>
                <button
                  className="btn-sm"
                  onClick={() => syncHook(agent.id)}
                  disabled={syncing === agent.id}
                >
                  {syncing === agent.id ? "..." : "同步"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
