import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  agentSpawn: "idle",
  userPromptSubmit: "thinking",
  preToolUse: "working",
  postToolUse: "working",
  stop: "attention",
};

export const kiroCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "kiro-cli",
  name: "Kiro CLI",
  integrationKind: "kiro-agents",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["kiro.exe"], mac: ["kiro"], linux: ["kiro"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".kiro", "agents"), type: "agents-dir" },
    { platform: "mac", path: join(homedir(), ".kiro", "agents"), type: "agents-dir" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, sessionEnd: false, subagent: false },
  hookConfig: {
    configFormat: "kiro-agent-json",
    scriptName: "kiro-hook.js",
    events: ["agentSpawn", "userPromptSubmit", "preToolUse", "postToolUse", "stop"],
  },
  stdinFormat: "camelCase",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("kiro-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
