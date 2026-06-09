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

export const kiroCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "kiro-cli",
  name: "Kiro CLI",
  eventMap: EVENT_MAP,
  processNames: { win: ["kiro.exe"], mac: ["kiro"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("kiro-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
