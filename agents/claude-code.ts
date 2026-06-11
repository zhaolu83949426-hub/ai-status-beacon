import type { AgentDescriptor } from "../shared/agent-types";
import type { AgentStateEvent, BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const CLAUDE_EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  SessionEnd: "sleeping",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PostToolUse: "working",
  PostToolUseFailure: "error",
  Stop: "attention",
  StopFailure: "error",
  ApiError: "error",
  SubagentStart: "juggling",
  SubagentStop: "working",
  PreCompact: "sweeping",
  PostCompact: "attention",
  Notification: "notification",
  Elicitation: "notification",
  WorktreeCreate: "carrying",
};

export const claudeCodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "claude-code",
  name: "Claude Code",
  integrationKind: "claude-settings",
  eventSource: "hook",
  eventMap: CLAUDE_EVENT_MAP,
  processNames: { win: ["claude.exe"], mac: ["claude"], linux: ["claude"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".claude", "settings.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".claude", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: true, notificationHook: true, sessionEnd: true, subagent: true },
  hookConfig: {
    configFormat: "claude-code-compatible",
    scriptName: "clawd-hook.js",
    events: [
      "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
      "PostToolUseFailure", "Stop", "SubagentStart", "SubagentStop", "Notification",
      "Elicitation", "PreCompact", "PostCompact", "StopFailure", "ApiError",
    ],
    permissionEvents: ["PermissionRequest"],
  },
  pidField: "claude_pid",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) {
    return makeEvent("claude-code", input, CLAUDE_EVENT_MAP);
  },
  mapPermission(input) {
    const base = makePermission(input);
    // Claude Code sends tool_input as JSON string sometimes
    if (typeof base.rawInput === "string") {
      try { base.rawInput = JSON.parse(base.rawInput); } catch { /* keep as string */ }
    }
    return base;
  },
});
