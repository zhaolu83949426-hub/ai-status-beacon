import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  PromptSubmit: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  ResponseComplete: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const copilotCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "copilot-cli",
  name: "GitHub Copilot CLI",
  eventMap: EVENT_MAP,
  processNames: { win: ["github-copilot-cli.exe"], mac: ["github-copilot-cli"] },
  configPaths: [],
  capabilities: { state: true, permission: true },
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("copilot-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
