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

export const piDescriptor: AgentDescriptor = baseDescriptor({
  id: "pi",
  name: "Pi",
  integrationKind: "pi-extension",
  eventSource: "extension",
  eventMap: EVENT_MAP,
  processNames: { win: ["pi.exe"], mac: ["pi"], linux: ["pi"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".pi", "agent", "extensions", "ai-status-beacon"), type: "extension" },
    { platform: "mac", path: join(homedir(), ".pi", "agent", "extensions", "ai-status-beacon"), type: "extension" },
  ],
  capabilities: { state: true, permission: false, httpHook: false, notificationHook: false, interactiveBubble: false, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "pi-extension",
    events: Object.keys(EVENT_MAP),
  },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("pi", input); },
  mapPermission(input) { return makePermission(input); },
});
