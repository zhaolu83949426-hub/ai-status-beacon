import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  PreInvocation: "thinking",
  PostToolUse: "working",
  PostToolUseFailure: "error",
  PostInvocation: "idle",
  Stop: "attention",
  StopFailure: "error",
};

export const antigravityCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "antigravity-cli",
  name: "Antigravity CLI",
  integrationKind: "antigravity-hooks",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["antigravity.exe"], mac: ["antigravity"], linux: ["antigravity"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".gemini", "config", "hooks.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".gemini", "config", "hooks.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: false, httpHook: false, notificationHook: false, interactiveBubble: false, sessionEnd: true, subagent: true },
  hookConfig: {
    configFormat: "antigravity-hooks-json",
    scriptName: "antigravity-hook.js",
    events: ["PreInvocation", "PostToolUse", "PostToolUseFailure", "PostInvocation", "Stop", "StopFailure"],
  },
  stdinFormat: "antigravityHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: false,
  mapEvent(input) { return makeEvent("antigravity-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
