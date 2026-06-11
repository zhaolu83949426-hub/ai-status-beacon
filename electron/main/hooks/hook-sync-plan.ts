import type { AgentDescriptor, AgentHookConfigFormat } from "../../../shared/agent-types";
import type { AgentSettings, HookSyncResult } from "../../../shared/types";

export const BEACON_MARKER = "ai-status-beacon";
export const STATE_HOOK_TIMEOUT_SECONDS = 5;
export const PERMISSION_HOOK_TIMEOUT_SECONDS = 600;
export const LEGACY_BEACON_COMMAND_MARKERS = ["state-hook.js", "permission-hook.js"];

type HookEntry = Record<string, unknown>;

export interface HookPlan {
  agentId: string;
  format: AgentHookConfigFormat;
  scriptName?: string;
  entries: Record<string, HookEntry[]>;
  rootGroup?: Record<string, unknown>;
  markers: string[];
}

const KNOWN_HOOK_EVENTS = [
  "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "PostToolUseFailure", "Stop", "StopFailure", "SubagentStart", "SubagentStop",
  "Notification", "Elicitation", "PreCompact", "PostCompact", "PermissionRequest",
  "BeforeAgent", "AfterAgent", "BeforeTool", "AfterTool", "PreCompress",
  "sessionStart", "sessionEnd", "beforeSubmitPrompt", "userPromptSubmitted",
  "preToolUse", "postToolUse", "postToolUseFailure", "errorOccurred", "agentStop",
  "subagentStart", "subagentStop", "preCompact", "afterAgentThought", "stop",
  "permissionRequest", "agentSpawn", "userPromptSubmit", "PostInvocation",
  "PreInvocation", "PermissionDenied",
];

export function buildHookPlan(options: {
  agent: AgentDescriptor;
  settings: AgentSettings;
  nodeBin: string;
  hooksDir: string;
  port: number;
  platform: NodeJS.Platform;
}): HookPlan {
  const config = options.agent.hookConfig;
  if (!config) return emptyPlan(options.agent);
  const markers = [config.scriptName, ...LEGACY_BEACON_COMMAND_MARKERS].filter(Boolean) as string[];
  const command = (event?: string) => buildCommand(options, config.scriptName, event);
  const entries = buildEntries(options, command);
  const rootGroup = config.configFormat === "antigravity-hooks-json"
    ? buildAntigravityGroup(entries)
    : undefined;
  return { agentId: options.agent.id, format: config.configFormat, scriptName: config.scriptName, entries, rootGroup, markers };
}

export function inspectHookStatus(config: Record<string, unknown>, plan: HookPlan): HookSyncResult["hookStatus"] {
  if (plan.rootGroup) return inspectRootGroup(config, plan);
  const hooks = readHooks(config);
  for (const [event, expected] of Object.entries(plan.entries)) {
    const current = getEventEntries(hooks, event);
    if (!hasExpectedManagedEntries(current, expected, plan.markers)) return "outdated";
  }
  return "synced";
}

export function applyHookPlan(config: Record<string, unknown>, plan: HookPlan): boolean {
  if (plan.rootGroup) {
    if (JSON.stringify(config.clawd) === JSON.stringify(plan.rootGroup)) return false;
    config.clawd = plan.rootGroup;
    return true;
  }
  const hooks = ensureHooks(config);
  let changed = false;
  for (const event of eventsToClean(plan)) {
    const filtered = filterManagedEntries(getEventEntries(hooks, event), plan.markers);
    const next = [...filtered, ...(plan.entries[event] ?? [])];
    if (JSON.stringify(getEventEntries(hooks, event)) !== JSON.stringify(next)) {
      setEventEntries(hooks, event, next);
      changed = true;
    }
  }
  return changed;
}

function emptyPlan(agent: AgentDescriptor): HookPlan {
  return { agentId: agent.id, format: "claude-code-compatible", entries: {}, markers: [...LEGACY_BEACON_COMMAND_MARKERS] };
}

function buildEntries(options: {
  agent: AgentDescriptor;
  settings: AgentSettings;
  port: number;
  platform: NodeJS.Platform;
}, command: (event?: string) => string): Record<string, HookEntry[]> {
  const config = options.agent.hookConfig;
  if (!config) return {};
  const entries: Record<string, HookEntry[]> = {};
  for (const event of config.events) {
    if (!shouldRegisterEvent(options, event)) continue;
    entries[event] = [buildEntry(config.configFormat, event, command, options)];
  }
  for (const event of config.permissionEvents ?? []) {
    if (entries[event] || !options.settings.permissionEnabled) continue;
    entries[event] = [buildPermissionEntry(options.agent.id, options.port)];
  }
  return entries;
}

function shouldRegisterEvent(options: { agent: AgentDescriptor; settings: AgentSettings }, event: string): boolean {
  const permissionEvents = options.agent.hookConfig?.permissionEvents ?? [];
  if (permissionEvents.includes(event)) return options.settings.permissionEnabled && options.agent.capabilities.permission;
  return options.settings.stateEnabled && options.agent.capabilities.state;
}

function buildEntry(
  format: AgentHookConfigFormat,
  event: string,
  command: (event?: string) => string,
  options: { platform: NodeJS.Platform },
): HookEntry {
  if (format === "user-global-hooks-json") return buildCopilotEntry(event, command(event));
  if (format === "cursor-hooks-json" || format === "kiro-agent-json") return { command: command(event) };
  if (format === "codex-hooks-json") return { hooks: [{ type: "command", command: command(), timeout: codexTimeout(event) }] };
  if (format === "qwen-settings-json") return buildNamedNestedEntry(event, command(event), qwenTimeout(event), qwenMatcher(event));
  if (format === "gemini-settings-json") return buildNamedNestedEntry(event, command(event), undefined, "*");
  if (format === "qoder-settings-json") return buildNamedNestedEntry(event, command(event), undefined, "*");
  if (format === "antigravity-hooks-json") return buildAntigravityEntry(event, command(event));
  return buildClaudeCompatibleEntry(event, command(event), options.platform);
}

function buildClaudeCompatibleEntry(event: string, command: string, platform: NodeJS.Platform): HookEntry {
  return {
    matcher: "",
    hooks: [{ type: "command", command, async: true, timeout: STATE_HOOK_TIMEOUT_SECONDS, ...(platform === "win32" ? { shell: "powershell" } : {}) }],
  };
}

function buildPermissionEntry(agentId: string, port: number): HookEntry {
  const url = new URL(`http://127.0.0.1:${port}/permission`);
  url.searchParams.set("agentId", agentId);
  return {
    matcher: "",
    hooks: [{ type: "http", url: url.toString(), timeout: PERMISSION_HOOK_TIMEOUT_SECONDS }],
  };
}

function buildNamedNestedEntry(event: string, command: string, timeout?: number, matcher?: string | null): HookEntry {
  const hook = { name: "clawd", type: "command", command, ...(timeout ? { timeout } : {}) };
  return { ...(matcher === null ? {} : { matcher }), hooks: [hook] };
}

function buildCopilotEntry(event: string, command: string): HookEntry {
  const rawCommand = command.replace(/^&\s*/, "");
  return {
    type: "command",
    bash: rawCommand,
    powershell: `& ${rawCommand}`,
    timeoutSec: event === "permissionRequest" ? PERMISSION_HOOK_TIMEOUT_SECONDS : STATE_HOOK_TIMEOUT_SECONDS,
  };
}

function buildAntigravityEntry(event: string, command: string): HookEntry {
  const hook = { type: "command", command, timeout: 10 };
  return event === "PostToolUse" ? { matcher: "*", hooks: [hook] } : hook;
}

function buildAntigravityGroup(entries: Record<string, HookEntry[]>): Record<string, unknown> {
  const group: Record<string, unknown> = {};
  for (const [event, eventEntries] of Object.entries(entries)) group[event] = eventEntries;
  return group;
}

function inspectRootGroup(config: Record<string, unknown>, plan: HookPlan): HookSyncResult["hookStatus"] {
  const current = config.clawd;
  if (!current || typeof current !== "object") return "outdated";
  return JSON.stringify(current) === JSON.stringify(plan.rootGroup) ? "synced" : "outdated";
}

function buildCommand(
  options: { nodeBin: string; hooksDir: string; platform: NodeJS.Platform },
  scriptName?: string,
  event?: string,
): string {
  const scriptPath = `${options.hooksDir}/${scriptName ?? "clawd-hook.js"}`.replace(/\\/g, "/");
  const base = `"${options.nodeBin}" "${scriptPath}"${event ? ` "${event}"` : ""}`;
  return options.platform === "win32" ? `& ${base}` : base;
}

function codexTimeout(event: string): number {
  return event === "PermissionRequest" ? PERMISSION_HOOK_TIMEOUT_SECONDS : 30;
}

function qwenTimeout(event: string): number {
  return event === "PermissionRequest" ? 600000 : 30000;
}

function qwenMatcher(event: string): string | null {
  return event === "UserPromptSubmit" || event === "Stop" ? null : "*";
}

function ensureHooks(config: Record<string, unknown>): Record<string, unknown> {
  if (!config.hooks || typeof config.hooks !== "object") config.hooks = {};
  return config.hooks as Record<string, unknown>;
}

function readHooks(config: Record<string, unknown>): Record<string, unknown> {
  return config.hooks && typeof config.hooks === "object" ? config.hooks as Record<string, unknown> : {};
}

function getEventEntries(hooks: Record<string, unknown>, event: string): HookEntry[] {
  const value = hooks[event];
  if (Array.isArray(value)) return value as HookEntry[];
  if (value && typeof value === "object") return [value as HookEntry];
  return [];
}

function setEventEntries(hooks: Record<string, unknown>, event: string, entries: HookEntry[]): void {
  if (entries.length === 0) delete hooks[event];
  else hooks[event] = entries;
}

function eventsToClean(plan: HookPlan): string[] {
  return [...new Set([...KNOWN_HOOK_EVENTS, ...Object.keys(plan.entries)])];
}

function hasExpectedManagedEntries(current: HookEntry[], expected: HookEntry[], markers: string[]): boolean {
  const managed = current.filter((entry) => entryHasMarker(entry, markers));
  return JSON.stringify(managed) === JSON.stringify(expected);
}

function filterManagedEntries(entries: HookEntry[], markers: string[]): HookEntry[] {
  const next: HookEntry[] = [];
  for (const entry of entries) {
    const filtered = filterEntry(entry, markers);
    if (filtered) next.push(filtered);
  }
  return next;
}

function filterEntry(entry: HookEntry, markers: string[]): HookEntry | null {
  if (entryHasOwnMarker(entry, markers)) return null;
  if (!Array.isArray(entry.hooks)) return entry;
  const hooks = (entry.hooks as HookEntry[]).filter((hook) => !entryHasOwnMarker(hook, markers));
  if (hooks.length === 0) return null;
  return hooks.length === entry.hooks.length ? entry : { ...entry, hooks };
}

function entryHasMarker(entry: HookEntry, markers: string[]): boolean {
  if (entryHasOwnMarker(entry, markers)) return true;
  return Array.isArray(entry.hooks) && (entry.hooks as HookEntry[]).some((hook) => entryHasOwnMarker(hook, markers));
}

function entryHasOwnMarker(entry: HookEntry, markers: string[]): boolean {
  const url = entry.url;
  if (typeof url === "string" && isManagedPermissionUrl(url)) return true;
  return ["command", "bash", "powershell", "url"].some((field) => {
    const value = entry[field];
    return typeof value === "string" && markers.some((marker) => value.includes(marker));
  });
}

function isManagedPermissionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.pathname === "/permission";
  } catch {
    return false;
  }
}
