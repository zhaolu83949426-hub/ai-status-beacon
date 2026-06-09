import type { BeaconState } from "../../../shared/types";

// Generic event → BeaconState mapping.
// Agent-specific maps will be layered on top via the agent registry.

const GENERIC_EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  PreToolUse: "working",
  PostToolUse: "working",
  Thinking: "working",
  Generating: "working",
  CompressingContext: "working",
  SubagentStart: "working",
  SubagentEnd: "idle",
  Stop: "idle",
  SessionEnd: "idle",
  TaskComplete: "idle",
  Error: "error",
  ToolFailure: "error",
  WaitingForApproval: "approval",
  WaitingForInput: "approval",
};

// Per-agent event map overrides (populated during agent registration)
const agentEventMaps = new Map<string, Record<string, BeaconState>>();

export function registerAgentEventMap(agentId: string, map: Record<string, BeaconState>): void {
  agentEventMaps.set(agentId, map);
}

export function mapEventToBeaconState(agentId: string, event: string): BeaconState {
  const agentMap = agentEventMaps.get(agentId);
  if (agentMap && event in agentMap) {
    return agentMap[event];
  }
  if (event in GENERIC_EVENT_MAP) {
    return GENERIC_EVENT_MAP[event];
  }
  // Unknown events default to "working" if it looks like an active event
  const activeKeywords = ["start", "begin", "submit", "use", "call", "run", "exec"];
  const lower = event.toLowerCase();
  if (activeKeywords.some((kw) => lower.includes(kw))) {
    return "working";
  }
  return "idle";
}
