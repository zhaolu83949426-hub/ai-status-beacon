import type { BeaconState, AgentStateEvent, PermissionRequest } from "./types";

export interface AgentConfigPath {
  platform: "win" | "mac";
  path: string;
  type: "settings" | "credentials" | "feature" | "plugin" | "extension" | "agents-dir";
}

export type AgentIntegrationKind =
  | "claude-settings"
  | "codex-hooks"
  | "gemini-settings"
  | "copilot-hooks"
  | "kimi-toml"
  | "qwen-settings"
  | "opencode-plugin"
  | "kiro-agents"
  | "cursor-hooks"
  | "codebuddy-settings"
  | "hermes-plugin"
  | "qoder-settings"
  | "pi-extension"
  | "openclaw-plugin"
  | "antigravity-hooks";

export type AgentEventSource =
  | "hook"
  | "hook+log-poll"
  | "plugin-event"
  | "extension";

export type AgentHookConfigFormat =
  | "claude-code-compatible"
  | "codex-hooks-json"
  | "gemini-settings-json"
  | "user-global-hooks-json"
  | "cursor-hooks-json"
  | "kimi-toml"
  | "qwen-settings-json"
  | "qoder-settings-json"
  | "kiro-agent-json"
  | "hermes-plugin"
  | "antigravity-hooks-json"
  | "opencode-plugin"
  | "pi-extension"
  | "openclaw-plugin";

export interface AgentHookConfig {
  configFormat: AgentHookConfigFormat;
  scriptName?: string;
  events: string[];
  permissionEvents?: string[];
}

export interface AgentDescriptor {
  id: string;
  name: string;
  integrationKind: AgentIntegrationKind;
  eventSource: AgentEventSource;
  processNames: {
    win: string[];
    mac: string[];
    linux?: string[];
  };
  configPaths: AgentConfigPath[];
  capabilities: {
    state: boolean;
    permission: boolean;
    httpHook?: boolean;
    notificationHook?: boolean;
    interactiveBubble?: boolean;
    sessionEnd?: boolean;
    subagent?: boolean;
  };
  hookConfig?: AgentHookConfig;
  stdinFormat?: string;
  pidField?: string;
  defaultStateEnabled: boolean;
  defaultPermissionEnabled: boolean;
  eventMap: Record<string, BeaconState>;
  mapEvent(input: Record<string, unknown>): AgentStateEvent;
  mapPermission(input: Record<string, unknown>): Partial<PermissionRequest>;
}
