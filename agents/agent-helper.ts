import type { AgentDescriptor } from "../shared/agent-types";
import type { AgentStateEvent, PermissionRequest, BeaconState } from "../shared/types";

export function makeEvent(
  agentId: string,
  input: Record<string, unknown>,
  overrides: Partial<Record<string, BeaconState>> = {},
): AgentStateEvent {
  const event = (input.event as string) ?? (input.state as string) ?? "unknown";
  return {
    agentId,
    sessionId: (input.session_id as string) ?? (input.sessionId as string) ?? "default",
    event,
    rawState: input.state as string | undefined,
    cwd: input.cwd as string | undefined,
    toolName: input.tool_name as string | undefined ?? input.toolName as string | undefined,
    sourcePid: input.source_pid as number | undefined ?? input.sourcePid as number | undefined,
    agentPid: input.agent_pid as number | undefined ?? input.claude_pid as number | undefined,
    model: input.model as string | undefined,
    provider: input.provider as string | undefined,
    occurredAt: Date.now(),
  };
}

export function makePermission(
  input: Record<string, unknown>,
): Partial<PermissionRequest> {
  return {
    toolName: (input.tool_name as string) ?? (input.toolName as string) ?? "",
    summary: (input.summary as string) ?? (input.tool_input as string) ?? "",
    cwd: input.cwd as string | undefined,
    riskHint: input.risk_hint as string | undefined,
    rawInput: input.tool_input ?? input.rawInput ?? input,
    suggestions: (input.suggestions as PermissionRequest["suggestions"]) ?? [],
    requiresTextInput: (input.requires_text_input as boolean) ?? false,
  };
}

export function baseDescriptor(overrides: Partial<AgentDescriptor> & Pick<AgentDescriptor, "id" | "name" | "eventMap">): AgentDescriptor {
  return {
    integrationKind: "claude-settings",
    eventSource: "hook",
    processNames: { win: [], mac: [] },
    configPaths: [],
    capabilities: { state: true, permission: false },
    defaultStateEnabled: true,
    defaultPermissionEnabled: false,
    mapEvent(input) { return makeEvent(overrides.id, input as Record<string, unknown>); },
    mapPermission(input) { return makePermission(input as Record<string, unknown>); },
    ...overrides,
  };
}
