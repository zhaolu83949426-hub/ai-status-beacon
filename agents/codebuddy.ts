import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  SessionEnd: "sleeping",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PostToolUse: "working",
  Stop: "attention",
  PermissionRequest: "notification",
  Notification: "notification",
  PreCompact: "sweeping",
};

export const codebuddyDescriptor: AgentDescriptor = baseDescriptor({
  id: "codebuddy",
  name: "CodeBuddy",
  integrationKind: "codebuddy-settings",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["codebuddy.exe"], mac: ["codebuddy"], linux: ["codebuddy"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".codebuddy", "settings.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".codebuddy", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: true, notificationHook: true, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "claude-code-compatible",
    scriptName: "codebuddy-hook.js",
    events: ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "Notification", "PreCompact"],
    permissionEvents: ["PermissionRequest"],
  },
  stdinFormat: "claudeCodeHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("codebuddy", input); },
  mapPermission(input) { return makePermission(input); },
});
