// ── Beacon State ──

export type BeaconState =
  | "idle"
  | "sleeping"
  | "thinking"
  | "working"
  | "attention"
  | "approval"
  | "notification"
  | "juggling"
  | "sweeping"
  | "carrying"
  | "codex-turn-end"
  | "error";

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
  | "minimax_token_plan"
  | "deepseek_balance"
  | "stepfun_balance"
  | "siliconflow_balance"
  | "openrouter_balance"
  | "novita_balance";

// 额度账号的基础信息，凭据单独存放在安全存储中。
export interface QuotaAccount {
  id: string;
  type: QuotaAccountType;
  displayName: string;
  baseUrl?: string | null;
  createdAt: number;
  updatedAt: number;
}

// 设置页新增或编辑账号时使用的录入结构。
export interface QuotaAccountFormData {
  id: string;
  type: QuotaAccountType;
  displayName: string;
  baseUrl: string;
  secret: string;
}

export interface QuotaAccountValidationErrors {
  displayName?: string;
  baseUrl?: string;
  secret?: string;
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

// 设置页展示的 Agent 注册信息。
export interface AgentMetadata {
  id: string;
  name: string;
  installed: boolean;
  configPaths: string[];
  hookStatus?: HookSyncResult["hookStatus"];
  capabilities: {
    state: boolean;
    permission: boolean;
  };
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

// ── Updater ──

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export interface UpdateProgress {
  status: UpdateStatus;
  latestVersion?: string;
  downloadProgress?: number;
}

// ── IPC API ──

export interface BeaconApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  listAgents(): Promise<AgentMetadata[]>;
  setAgentFlag(agentId: string, flag: keyof AgentSettings, value: boolean): Promise<AppSettings>;
  saveQuotaAccount(input: QuotaAccountFormData): Promise<AppSettings>;
  deleteQuotaAccount(accountId: string): Promise<AppSettings>;
  getBeaconSnapshot(): Promise<BeaconSnapshot>;
  onBeaconSnapshot(listener: (snapshot: BeaconSnapshot) => void): () => void;
  getDashboardSessions(): Promise<DashboardSessionView[]>;
  getPendingPermissions(): Promise<(PendingPermission & { agentName?: string })[]>;
  decidePermission(id: string, decision: PermissionDecision): Promise<void>;
  onPlaySound(listener: (payload: { url: string; volume?: number }) => void): () => void;
  refreshQuota(accountId: string): Promise<AccountQuotaSnapshot>;
  toggleSound(enabled: boolean): Promise<void>;
  pickSoundFile(eventKey: keyof AppSettings["sound"]): Promise<string | null>;
  previewSound(eventKey: keyof AppSettings["sound"], customPath?: string | null): Promise<void>;
  checkForUpdates(): Promise<UpdateProgress>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  getUpdateStatus(): Promise<UpdateProgress>;
  onUpdateStatus(listener: (progress: UpdateProgress) => void): () => void;
  getAppVersion(): Promise<string>;
}

declare global {
  interface Window {
    beaconApi: BeaconApi;
  }
}
