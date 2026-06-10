import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  sessionStart: "idle",
  sessionEnd: "sleeping",
  userPromptSubmitted: "thinking",
  preToolUse: "working",
  postToolUse: "working",
  errorOccurred: "error",
  agentStop: "attention",
  subagentStart: "juggling",
  subagentStop: "working",
  preCompact: "sweeping",
};

export const copilotCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "copilot-cli",
  name: "Copilot CLI",
  integrationKind: "copilot-hooks",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["copilot.exe"], mac: ["copilot"], linux: ["copilot"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".copilot", "hooks", "hooks.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".copilot", "hooks", "hooks.json"), type: "settings" },
    { platform: "win", path: join(homedir(), ".copilot", "settings.json"), type: "feature" },
    { platform: "mac", path: join(homedir(), ".copilot", "settings.json"), type: "feature" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, interactiveBubble: true, sessionEnd: true, subagent: true },
  hookConfig: {
    configFormat: "user-global-hooks-json",
    scriptName: "copilot-hook.js",
    events: [
      "sessionStart", "userPromptSubmitted", "preToolUse", "postToolUse", "sessionEnd",
      "errorOccurred", "agentStop", "subagentStart", "subagentStop", "preCompact", "permissionRequest",
    ],
    permissionEvents: ["permissionRequest"],
  },
  stdinFormat: "camelCase",
  pidField: "copilot_pid",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("copilot-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
