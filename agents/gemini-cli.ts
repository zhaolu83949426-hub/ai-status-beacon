import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  Thinking: "working",
  Generating: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  ResponseComplete: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const geminiCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "gemini-cli",
  name: "Gemini CLI",
  eventMap: EVENT_MAP,
  processNames: { win: ["gemini.exe"], mac: ["gemini"] },
  configPaths: [
    { platform: "mac", path: join(homedir(), ".gemini", "settings.json"), type: "settings" },
    { platform: "win", path: join(homedir(), ".gemini", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: false },
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("gemini-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
