import { existsSync } from "fs";
import type { AgentDescriptor } from "../../../shared/agent-types";
import type { AgentMetadata, AgentSettings, HookSyncResult } from "../../../shared/types";
import { registerAgentEventMap } from "../state/state-mapper";

import { claudeCodeDescriptor } from "../../../agents/claude-code";
import { codexDescriptor } from "../../../agents/codex";
import { geminiCliDescriptor } from "../../../agents/gemini-cli";
import { copilotCliDescriptor } from "../../../agents/copilot-cli";
import { kimiCliDescriptor } from "../../../agents/kimi-cli";
import { qwenCodeDescriptor } from "../../../agents/qwen-code";
import { opencodeDescriptor } from "../../../agents/opencode";
import { kiroCliDescriptor } from "../../../agents/kiro-cli";
import { cursorAgentDescriptor } from "../../../agents/cursor-agent";
import { codebuddyDescriptor } from "../../../agents/codebuddy";
import { hermesDescriptor } from "../../../agents/hermes";
import { qoderDescriptor } from "../../../agents/qoder";
import { piDescriptor } from "../../../agents/pi";
import { openclawDescriptor } from "../../../agents/openclaw";
import { antigravityCliDescriptor } from "../../../agents/antigravity-cli";

const ALL_AGENTS: AgentDescriptor[] = [
  claudeCodeDescriptor,
  codexDescriptor,
  geminiCliDescriptor,
  copilotCliDescriptor,
  kimiCliDescriptor,
  qwenCodeDescriptor,
  opencodeDescriptor,
  kiroCliDescriptor,
  cursorAgentDescriptor,
  codebuddyDescriptor,
  hermesDescriptor,
  qoderDescriptor,
  piDescriptor,
  openclawDescriptor,
  antigravityCliDescriptor,
];

const registry = new Map<string, AgentDescriptor>();

export function initRegistry(): void {
  for (const agent of ALL_AGENTS) {
    registry.set(agent.id, agent);
    registerAgentEventMap(agent.id, agent.eventMap);
  }
}

export function getAllAgents(): AgentDescriptor[] {
  return ALL_AGENTS;
}

export function getAgent(id: string): AgentDescriptor | undefined {
  return registry.get(id);
}

export function detectInstalledAgents(): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const platform = process.platform === "win32" ? "win" : "mac";

  for (const agent of ALL_AGENTS) {
    const configPaths = agent.configPaths.filter((p) => p.platform === platform);
    if (configPaths.length === 0) {
      // No config path defined — assume installed if we can't check
      result.set(agent.id, true);
      continue;
    }
    const installed = configPaths.some((p) => existsSync(p.path));
    result.set(agent.id, installed);
  }
  return result;
}

export function listAgentMetadata(hookStatusByAgent: Record<string, HookSyncResult["hookStatus"]> = {}): AgentMetadata[] {
  const installedAgents = detectInstalledAgents();
  const platform = process.platform === "win32" ? "win" : "mac";

    return ALL_AGENTS.map((agent) => ({
      id: agent.id,
      name: agent.name,
      installed: installedAgents.get(agent.id) ?? false,
      hookStatus: hookStatusByAgent[agent.id],
      configPaths: agent.configPaths
      .filter((p) => p.platform === platform)
      .map((p) => p.path),
      capabilities: agent.capabilities,
    }));
}

export function getDefaultAgentSettings(): Record<string, AgentSettings> {
  const settings: Record<string, AgentSettings> = {};
  for (const agent of ALL_AGENTS) {
    settings[agent.id] = {
      stateEnabled: agent.defaultStateEnabled,
      permissionEnabled: agent.defaultPermissionEnabled,
    };
  }
  return settings;
}
