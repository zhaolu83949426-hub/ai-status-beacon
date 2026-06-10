import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PermissionRequest: "notification",
  PostToolUse: "working",
  Stop: "codex-turn-end",
};

export const codexDescriptor: AgentDescriptor = baseDescriptor({
  id: "codex",
  name: "Codex CLI",
  integrationKind: "codex-hooks",
  eventSource: "hook+log-poll",
  eventMap: EVENT_MAP,
  processNames: { win: ["codex.exe"], mac: ["codex"], linux: ["codex"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".codex", "hooks.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".codex", "hooks.json"), type: "settings" },
    { platform: "win", path: join(homedir(), ".codex", "config.toml"), type: "feature" },
    { platform: "mac", path: join(homedir(), ".codex", "config.toml"), type: "feature" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, interactiveBubble: true, sessionEnd: false, subagent: false },
  hookConfig: {
    configFormat: "codex-hooks-json",
    scriptName: "codex-hook.js",
    events: ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "Stop"],
    permissionEvents: ["PermissionRequest"],
  },
  stdinFormat: "codexHookJson",
  pidField: "codex_pid",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("codex", input); },
  mapPermission(input) { return makePermission(input); },
});
