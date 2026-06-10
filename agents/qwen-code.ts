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
};

export const qwenCodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "qwen-code",
  name: "Qwen Code",
  integrationKind: "qwen-settings",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["qwen-code.exe"], mac: ["qwen-code"], linux: ["qwen-code"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".qwen", "settings.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".qwen", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, notificationHook: true, interactiveBubble: true, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "qwen-settings-json",
    scriptName: "qwen-code-hook.js",
    events: ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "Notification", "PermissionRequest"],
    permissionEvents: ["PermissionRequest"],
  },
  stdinFormat: "qwenHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("qwen-code", input); },
  mapPermission(input) { return makePermission(input); },
});
