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

export const hermesDescriptor: AgentDescriptor = baseDescriptor({
  id: "hermes",
  name: "Hermes",
  eventMap: EVENT_MAP,
  processNames: { win: ["hermes.exe"], mac: ["hermes"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("hermes", input); },
  mapPermission(input) { return makePermission(input); },
});
