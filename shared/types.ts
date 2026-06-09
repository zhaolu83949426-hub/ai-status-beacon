// ── Beacon State ──

export type BeaconState = "idle" | "working" | "approval" | "error";

// ── Agent Events ──

export interface AgentStateEvent {
  agentId: string;
  sessionId: string;
  event: string;
  rawState?: string;
  cwd?: string;
  toolName?: string;
  sourcePid?: number;
  agentPid?: number;
  model?: string;
  provider?: string;
  occurredAt: number;
}

export interface AgentSession {
  id: string;
  agentId: string;
  state: BeaconState;
  lastEvent: string;
  cwd: string;
  startedAt: number;
  updatedAt: number;
  sourcePid?: number;
  agentPid?: number;
  model?: string;
  provider?: string;
}

// ── Permission ──

export interface PermissionSuggestion {
  id: string;
  label: string;
  description?: string;
}

export interface PermissionRequest {
  id: string;
  agentId: string;
  sessionId: string;
  toolName: string;
  summary: string;
  cwd?: string;
  riskHint?: string;
  rawInput: unknown;
  suggestions: PermissionSuggestion[];
  requiresTextInput: boolean;
  createdAt: number;
}

export interface PendingPermission extends PermissionRequest {
  status: "pending" | "resolved" | "closed";
}

export interface PermissionDecision {
  behavior: "allow" | "deny" | "suggestion" | "no-decision";
  suggestionId?: string;
  text?: string;
  message?: string;
}

// ── Status Bar ──

export interface StatusBarPlacement {
  edge: "top" | "bottom" | "left" | "right";
  displayId: string;
  offsetRatio: number;
}

export interface StatusBarBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Quota ──

export type QuotaAccountType =
  | "claude_official"
  | "codex_oauth"
  | "gemini_official"
  | "github_copilot"
  | "kimi_token_plan"
  | "zhipu_token_plan"
  | "minimax_token_plan";

export interface QuotaAccount {
  id: string;
  type: QuotaAccountType;
  displayName: string;
  credentialRef: string;
  baseUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuotaDisplaySlots {
  slot1AccountId: string | null;
  slot2AccountId: string | null;
}

export interface QuotaTier {
  name: string;
  utilization: number;
  resetsAt: string | null;
  usedValueUsd?: number | null;
  maxValueUsd?: number | null;
  planLabel?: string | null;
}

export interface AccountQuotaSnapshot {
  accountId: string;
  accountType: QuotaAccountType;
  success: boolean;
  credentialStatus: "valid" | "expired" | "not_found" | "parse_error";
  tiers: QuotaTier[];
  error: string | null;
  queriedAt: number | null;
}

// ── Settings ──

export interface AgentSettings {
  stateEnabled: boolean;
  permissionEnabled: boolean;
}

export interface AppSettings {
  statusBar: {
    placement: StatusBarPlacement;
    lightMode: "single" | "triple";
  };
  startup: {
    enabled: boolean;
  };
  sound: {
    enabled: boolean;
    taskCompletePath: string | null;
    approvalPath: string | null;
    errorPath: string | null;
  };
  agents: Record<string, AgentSettings>;
  quota: {
    accounts: QuotaAccount[];
    displaySlots: QuotaDisplaySlots;
    refreshIntervalMinutes: number;
  };
}

// ── Snapshot ──

export interface BeaconSnapshot {
  state: BeaconState;
  lightMode: "single" | "triple";
  placement: StatusBarPlacement;
  pendingPermissionCount: number;
  quotaSlots: AccountQuotaSnapshot[];
}

// ── Agent / Hook ──

export interface HookSyncResult {
  agentId: string;
  installed: boolean;
  hookStatus: "synced" | "missing" | "outdated" | "unsupported" | "error";
  message?: string;
}

// ── Dashboard ──

export interface DashboardSessionView {
  agentId: string;
  agentName: string;
  state: BeaconState;
  lastEvent: string;
  cwd: string;
  startedAt: number;
  updatedAt: number;
}

// ── IPC API ──

export interface BeaconApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  getBeaconSnapshot(): Promise<BeaconSnapshot>;
  onBeaconSnapshot(listener: (snapshot: BeaconSnapshot) => void): () => void;
  getDashboardSessions(): Promise<DashboardSessionView[]>;
  getPendingPermissions(): Promise<(PendingPermission & { agentName?: string })[]>;
  decidePermission(id: string, decision: PermissionDecision): Promise<void>;
  refreshQuota(accountId: string): Promise<AccountQuotaSnapshot>;
  syncAgentHook(agentId: string): Promise<HookSyncResult>;
  toggleSound(enabled: boolean): Promise<void>;
}

declare global {
  interface Window {
    beaconApi: BeaconApi;
  }
}
