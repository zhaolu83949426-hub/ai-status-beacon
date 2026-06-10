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
  PostToolUseFailure: "error",
  Stop: "attention",
  StopFailure: "error",
  SubagentStart: "juggling",
  SubagentStop: "working",
  PreCompact: "sweeping",
  PostCompact: "attention",
  Notification: "notification",
};

export const kimiCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "kimi-cli",
  name: "Kimi CLI",
  integrationKind: "kimi-toml",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["kimi.exe"], mac: ["kimi"], linux: ["kimi"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".kimi", "config.toml"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".kimi", "config.toml"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: true, notificationHook: true, interactiveBubble: false, sessionEnd: true, subagent: true },
  hookConfig: {
    configFormat: "kimi-toml",
    scriptName: "kimi-hook.js",
    events: [
      "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
      "PostToolUseFailure", "Stop", "StopFailure", "SubagentStart", "SubagentStop",
      "PreCompact", "PostCompact", "Notification",
    ],
  },
  stdinFormat: "claudeHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("kimi-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
