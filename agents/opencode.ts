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
  PreCompact: "sweeping",
  PostCompact: "attention",
};

export const opencodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "opencode",
  name: "OpenCode",
  integrationKind: "opencode-plugin",
  eventSource: "plugin-event",
  eventMap: EVENT_MAP,
  processNames: { win: ["opencode.exe"], mac: ["opencode"], linux: ["opencode"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".config", "opencode", "opencode.json"), type: "plugin" },
    { platform: "mac", path: join(homedir(), ".config", "opencode", "opencode.json"), type: "plugin" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "opencode-plugin",
    events: Object.keys(EVENT_MAP),
  },
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("opencode", input); },
  mapPermission(input) { return makePermission(input); },
});
