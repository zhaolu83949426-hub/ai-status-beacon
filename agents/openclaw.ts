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
  StopFailure: "error",
  PreCompact: "sweeping",
  PostCompact: "attention",
  SessionEnd: "sleeping",
};

export const openclawDescriptor: AgentDescriptor = baseDescriptor({
  id: "openclaw",
  name: "OpenClaw",
  integrationKind: "openclaw-plugin",
  eventSource: "plugin-event",
  eventMap: EVENT_MAP,
  processNames: { win: ["openclaw.exe"], mac: ["openclaw"], linux: ["openclaw"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".openclaw", "openclaw.json"), type: "plugin" },
    { platform: "mac", path: join(homedir(), ".openclaw", "openclaw.json"), type: "plugin" },
  ],
  capabilities: { state: true, permission: false, httpHook: false, notificationHook: false, interactiveBubble: false, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "openclaw-plugin",
    events: Object.keys(EVENT_MAP),
  },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("openclaw", input); },
  mapPermission(input) { return makePermission(input); },
});
