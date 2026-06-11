const DEFAULT_HOOK_AGENT_ID = "claude-code";

const HOOK_SOURCE_AGENT_IDS = new Map<string, string>([
  ["antigravity-hook", "antigravity-cli"],
  ["codex-official", "codex"],
  ["copilot-hook", "copilot-cli"],
  ["opencode-plugin", "opencode"],
  ["openclaw-plugin", "openclaw"],
  ["pi-extension", "pi"],
]);

function normalizeHookText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

interface ResolvedAgentId {
  agentId: string;
  source: "explicit" | "hook-source" | "default";
  defaulted: boolean;
}

function resolveHookAgentId(data: Record<string, unknown>): ResolvedAgentId {
  const explicit = normalizeHookText(data.agent_id ?? data.agentId);
  if (explicit) {
    return { agentId: explicit, source: "explicit", defaulted: false };
  }

  const hookSource = normalizeHookText(data.hook_source);
  const sourceAgentId = HOOK_SOURCE_AGENT_IDS.get(hookSource);
  if (sourceAgentId) {
    return { agentId: sourceAgentId, source: "hook-source", defaulted: false };
  }

  return { agentId: DEFAULT_HOOK_AGENT_ID, source: "default", defaulted: true };
}

export { DEFAULT_HOOK_AGENT_ID, HOOK_SOURCE_AGENT_IDS, resolveHookAgentId };
export type { ResolvedAgentId };