import type { AgentDescriptor } from "../shared/agent-types";
import type { AgentStateEvent, BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const CLAUDE_EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  PreToolUse: "working",
  PostToolUse: "working",
  Notification: "working",
  SubagentStart: "working",
  SubagentStop: "idle",
  Stop: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const claudeCodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "claude-code",
  name: "Claude Code",
  eventMap: CLAUDE_EVENT_MAP,
  processNames: { win: ["claude.exe"], mac: ["claude"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".claude", "settings.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".claude", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true },
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
