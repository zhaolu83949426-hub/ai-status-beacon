import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  Thinking: "working",
  Generating: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  Stop: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const kimiCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "kimi-cli",
  name: "Kimi CLI",
  eventMap: EVENT_MAP,
  processNames: { win: ["kimi.exe"], mac: ["kimi"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("kimi-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
