import type { AgentDescriptor } from "../shared/agent-types";
import type { BeaconState } from "../shared/types";
import { baseDescriptor, makeEvent, makePermission } from "./agent-helper";
import { join } from "path";
import { homedir } from "os";

const EVENT_MAP: Record<string, BeaconState> = {
  sessionStart: "idle",
  sessionEnd: "sleeping",
  beforeSubmitPrompt: "thinking",
  preToolUse: "working",
  postToolUse: "working",
  postToolUseFailure: "working",
  stop: "attention",
  subagentStart: "juggling",
  subagentStop: "working",
  preCompact: "sweeping",
  afterAgentThought: "thinking",
};

export const cursorAgentDescriptor: AgentDescriptor = baseDescriptor({
  id: "cursor-agent",
  name: "Cursor Agent",
  integrationKind: "cursor-hooks",
  eventSource: "hook",
  eventMap: EVENT_MAP,
  processNames: { win: ["cursor-agent.exe", "cursor.exe"], mac: ["cursor-agent", "Cursor"], linux: ["cursor-agent", "cursor"] },
  configPaths: [
    { platform: "win", path: join(homedir(), ".cursor", "hooks.json"), type: "settings" },
    { platform: "mac", path: join(homedir(), ".cursor", "hooks.json"), type: "settings" },
  ],
  capabilities: { state: true, permission: true, httpHook: false, sessionEnd: true, subagent: true },
  hookConfig: {
    configFormat: "cursor-hooks-json",
    scriptName: "cursor-hook.js",
    events: [
      "sessionStart", "sessionEnd", "beforeSubmitPrompt", "preToolUse", "postToolUse",
      "postToolUseFailure", "subagentStart", "subagentStop", "preCompact", "afterAgentThought", "stop",
    ],
  },
  stdinFormat: "cursorHookJson",
  defaultStateEnabled: true,
  defaultPermissionEnabled: true,
  mapEvent(input) { return makeEvent("cursor-agent", input); },
  mapPermission(input) { return makePermission(input); },
});
