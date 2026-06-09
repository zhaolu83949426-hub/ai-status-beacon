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

export const qwenCodeDescriptor: AgentDescriptor = baseDescriptor({
  id: "qwen-code",
  name: "Qwen Code",
  eventMap: EVENT_MAP,
  processNames: { win: ["qwen-code.exe"], mac: ["qwen-code"] },
  configPaths: [],
  capabilities: { state: true, permission: true },
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("qwen-code", input); },
  mapPermission(input) { return makePermission(input); },
});
