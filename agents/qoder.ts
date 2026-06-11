import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PostToolUse: "working",
  PostToolUseFailure: "error",
  Stop: "attention",
  Notification: "notification",
  PermissionRequest: "notification",
  PermissionDenied: "notification",
  SessionEnd: "sleeping",
};

export const qoderDescriptor: AgentDescriptor = baseDescriptor({
  id: "qoder",
  name: "Qoder",
  integrationKind: "qoder-settings",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["qoder.exe", "qodercli.exe", "qoder-cli.exe"], mac: ["qoder", "qodercli", "qoder-cli"], linux: ["qoder", "qodercli", "qoder-cli"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".qoder", "settings.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".qoder", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: false, httpHook: false, notificationHook: true, interactiveBubble: false, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "qoder-settings-json",
    scriptName: "qoder-hook.js",
    events: [
      "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
      "Stop", "Notification", "PermissionRequest", "PermissionDenied", "SessionEnd",
    ],
  },
  stdinFormat: "qoderHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("qoder", input); },
  mapPermission(input) { return makePermission(input); },
});
