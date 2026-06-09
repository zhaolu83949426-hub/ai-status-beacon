import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  PreToolUse: "working",
  PostToolUse: "working",
  Thinking: "working",
  Stop: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const opencodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "opencode",
  name: "OpenCode",
  eventMap: EVENT_MAP,
  processNames: { win: ["opencode.exe"], mac: ["opencode"] },
  configPaths: [],
  capabilities: { state: true, permission: true },
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("opencode", input); },
  mapPermission(input) { return makePermission(input); },
});
