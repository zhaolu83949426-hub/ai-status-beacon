import type { PermissionDecision } from "../../../shared/types";

// Per-agent response formatting — different agents expect different response shapes.

export function formatPermissionResponse(
  agentId: string,
  decision: PermissionDecision,
): Record<string, unknown> {
  switch (agentId) {
    case "claude-code":
      return formatClaudeCodeResponse(decision);
    case "codex":
      return formatCodexResponse(decision);
    case "qwen-code":
    case "opencode":
    case "copilot-cli":
      return formatClaudeCodeResponse(decision);
    default:
      return formatGenericResponse(decision);
  }
}

function formatClaudeCodeResponse(decision: PermissionDecision): Record<string, unknown> {
  switch (decision.behavior) {
    case "allow":
      return { decision: "allow", reason: decision.message };
    case "deny":
      return { decision: "deny", reason: decision.message ?? "User denied" };
    case "suggestion":
      return {
        decision: "allow",
        reason: decision.message,
        edit: decision.text,
        suggestionId: decision.suggestionId,
      };
    default:
      return { decision: undefined };
  }
}

function formatCodexResponse(decision: PermissionDecision): Record<string, unknown> {
  switch (decision.behavior) {
    case "allow":
      return { approved: true };
    case "deny":
      return { approved: false, reason: decision.message ?? "User denied" };
    case "suggestion":
      return { approved: true, input: decision.text, suggestionId: decision.suggestionId };
    default:
      return {};
  }
}

function formatGenericResponse(decision: PermissionDecision): Record<string, unknown> {
  return {
    decision: decision.behavior,
    message: decision.message,
    text: decision.text,
    suggestionId: decision.suggestionId,
  };
}
