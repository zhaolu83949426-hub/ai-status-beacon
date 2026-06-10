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
  SessionEnd: "sleeping",
};

export const hermesDescriptor: AgentDescriptor = baseDescriptor({
  id: "hermes",
  name: "Hermes",
  integrationKind: "hermes-plugin",
  eventSource: "plugin-event",
  eventMap: EVENT_MAP,
  processNames: { win: ["hermes.exe"], mac: ["hermes"], linux: ["hermes"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".hermes", "plugins", "clawd-on-desk"), type: "plugin" },
    { platform: "mac", path: join(homedir(), ".hermes", "plugins", "clawd-on-desk"), type: "plugin" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, interactiveBubble: true, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "hermes-plugin",
    events: Object.keys(EVENT_MAP),
  },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("hermes", input); },
  mapPermission(input) { return makePermission(input); },
});
