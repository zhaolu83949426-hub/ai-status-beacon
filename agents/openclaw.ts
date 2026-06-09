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

export const openclawDescriptor: AgentDescriptor = baseDescriptor({
  id: "openclaw",
  name: "OpenClaw",
  eventMap: EVENT_MAP,
  processNames: { win: ["openclaw.exe"], mac: ["openclaw"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("openclaw", input); },
  mapPermission(input) { return makePermission(input); },
});
