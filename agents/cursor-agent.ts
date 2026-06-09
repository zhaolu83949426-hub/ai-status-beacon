import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  Thinking: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  ResponseComplete: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const cursorAgentDescriptor: AgentDescriptor = baseDescriptor({
  id: "cursor-agent",
  name: "Cursor Agent",
  eventMap: EVENT_MAP,
  processNames: { win: ["cursor-agent.exe", "cursor.exe"], mac: ["cursor-agent", "Cursor"] },
  configPaths: [],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("cursor-agent", input); },
  mapPermission(input) { return makePermission(input); },
});
