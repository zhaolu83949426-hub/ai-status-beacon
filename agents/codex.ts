import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  AgentReasoning: "working",
  ToolCallStart: "working",
  ToolCallEnd: "idle",
  ResponseComplete: "idle",
  SessionEnd: "idle",
  Error: "error",
};

export const codexDescriptor: AgentDescriptor = baseDescriptor({
  id: "codex",
  name: "Codex",
  eventMap: EVENT_MAP,
  processNames: { win: ["codex.exe"], mac: ["codex"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".codex", "config.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".codex", "config.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true },
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("codex", input); },
  mapPermission(input) { return makePermission(input); },
});
