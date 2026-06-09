import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  Thinking: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  Stop: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const antigravityCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "antigravity-cli",
  name: "Antigravity CLI",
  eventMap: EVENT_MAP,
  processNames: { win: ["antigravity.exe"], mac: ["antigravity"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("antigravity-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
