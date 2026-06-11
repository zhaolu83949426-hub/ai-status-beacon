import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  SessionStart: "idle",
  SessionEnd: "sleeping",
  BeforeAgent: "thinking",
  BeforeTool: "working",
  AfterTool: "working",
  PostToolUseFailure: "error",
  AfterAgent: "idle",
  Notification: "notification",
  PreCompress: "idle",
};

export const geminiCliDescriptor: AgentDescriptor = baseDescriptor({
  id: "gemini-cli",
  name: "Gemini CLI",
  integrationKind: "gemini-settings",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["gemini.exe"], mac: ["gemini"], linux: ["gemini"] },
  configPaths: [
    { platform: "mac", path: join(homedir(), ".gemini", "settings.json"), type: "settings" },
    { platform: "win", path: join(homedir(), ".gemini", "settings.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, notificationHook: true, sessionEnd: true, subagent: false },
  hookConfig: {
    configFormat: "gemini-settings-json",
    scriptName: "gemini-hook.js",
    events: ["SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent", "BeforeTool", "AfterTool", "Notification", "PreCompress"],
  },
  stdinFormat: "geminiHookJson",
  pidField: "gemini_pid",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("gemini-cli", input); },
  mapPermission(input) { return makePermission(input); },
});
