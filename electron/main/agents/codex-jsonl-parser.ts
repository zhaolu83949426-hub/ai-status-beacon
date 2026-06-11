type JsonRecord = Record<string, unknown>;

export interface CodexJsonlSnapshot {
  sessionId: string | null;
  cwd: string;
  hadToolUse: boolean;
  lastTransitionEvent: CodexJsonlTransition["event"] | null;
  pendingApprovalTimer?: ReturnType<typeof setTimeout>;
  pendingApprovalDetail?: { command: string; rawPayload: JsonRecord } | null;
}

export interface CodexJsonlTransition {
  sessionId: string;
  event:
    | "JsonlTaskStarted"
    | "JsonlUserMessage"
    | "JsonlGuardianAssessment"
    | "JsonlExecCommandEnd"
    | "JsonlPatchApplyEnd"
    | "JsonlCustomToolCallOutput"
    | "JsonlFunctionCall"
    | "JsonlCustomToolCall"
    | "JsonlWebSearchCall"
    | "JsonlContextCompacted"
    | "JsonlTaskComplete"
    | "JsonlTaskCompleteIdle"
    | "JsonlTurnAborted"
    | "JsonlPermissionRequest";
  cwd?: string;
  permissionDetail?: { command: string; rawPayload: JsonRecord };
}

const TRANSITION_EVENT_BY_KEY: Partial<Record<string, CodexJsonlTransition["event"]>> = {
  "event_msg:task_started": "JsonlTaskStarted",
  "event_msg:user_message": "JsonlUserMessage",
  "event_msg:guardian_assessment": "JsonlGuardianAssessment",
  "event_msg:exec_command_end": "JsonlExecCommandEnd",
  "event_msg:patch_apply_end": "JsonlPatchApplyEnd",
  "event_msg:custom_tool_call_output": "JsonlCustomToolCallOutput",
  "response_item:function_call": "JsonlFunctionCall",
  "response_item:custom_tool_call": "JsonlCustomToolCall",
  "response_item:web_search_call": "JsonlWebSearchCall",
  "event_msg:context_compacted": "JsonlContextCompacted",
  "event_msg:turn_aborted": "JsonlTurnAborted",
};

const TOOL_USE_EVENTS = new Set([
  "JsonlFunctionCall",
  "JsonlCustomToolCall",
  "JsonlWebSearchCall",
]);

function readPayload(entry: JsonRecord): JsonRecord {
  return entry.payload && typeof entry.payload === "object"
    ? entry.payload as JsonRecord
    : {};
}

function getLogKey(entry: JsonRecord, payload: JsonRecord): string {
  const type = typeof entry.type === "string" ? entry.type : "";
  const subtype = typeof payload.type === "string" ? payload.type : "";
  return subtype ? `${type}:${subtype}` : type;
}

function updateSessionMeta(snapshot: CodexJsonlSnapshot, payload: JsonRecord): void {
  const sessionId = payload.id;
  const cwd = payload.cwd;
  if (typeof sessionId === "string" && sessionId) snapshot.sessionId = sessionId;
  if (typeof cwd === "string" && cwd) snapshot.cwd = cwd;
}

function buildTransition(snapshot: CodexJsonlSnapshot, event: CodexJsonlTransition["event"], extra?: { permissionDetail?: { command: string; rawPayload: JsonRecord } }): CodexJsonlTransition | null {
  if (!snapshot.sessionId) return null;
  snapshot.lastTransitionEvent = event;
  const transition: CodexJsonlTransition = {
    sessionId: snapshot.sessionId,
    event,
    cwd: snapshot.cwd || undefined,
  };
  if (extra?.permissionDetail) {
    transition.permissionDetail = extra.permissionDetail;
  }
  return transition;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractShellCommand(payload: JsonRecord): string {
  if (!isObject(payload)) return "";
  if (payload.name !== "shell_command" && payload.name !== "exec_command") return "";
  try {
    let args: unknown = payload.arguments;
    if (typeof args === "string") {
      args = JSON.parse(args);
    }
    if (isObject(args)) {
      if (typeof args.command === "string") return args.command;
      if (typeof args.cmd === "string") return args.cmd;
    }
  } catch {}
  return "";
}

function isExplicitApprovalRequest(payload: JsonRecord): boolean {
  if (!isObject(payload)) return false;
  if (payload.name !== "shell_command" && payload.name !== "exec_command") return false;
  try {
    let args: unknown = payload.arguments;
    if (typeof args === "string") {
      args = JSON.parse(args);
    }
    if (!isObject(args)) return false;
    if (args.sandbox_permissions === "require_escalated") return true;
    if (typeof args.justification === "string" && args.justification.trim()) return true;
  } catch {}
  return false;
}

function isGuardianApprovalActivity(payload: JsonRecord): boolean {
  if (!isObject(payload)) return false;
  if (payload.type !== "guardian_assessment") return false;
  const status = payload.status;
  return status === "in_progress" || status === "approved";
}

export function applyCodexJsonlEntry(
  snapshot: CodexJsonlSnapshot,
  entry: JsonRecord,
): CodexJsonlTransition | null {
  const payload = readPayload(entry);
  const key = getLogKey(entry, payload);

  if (key === "event_msg:exec_command_end" || key === "response_item:function_call_output" || isGuardianApprovalActivity(payload)) {
    if (snapshot.pendingApprovalTimer) {
      clearTimeout(snapshot.pendingApprovalTimer);
      snapshot.pendingApprovalTimer = undefined;
    }
    snapshot.pendingApprovalDetail = null;
  }

  if (key === "session_meta") {
    updateSessionMeta(snapshot, payload);
    return null;
  }
  const mappedEvent = TRANSITION_EVENT_BY_KEY[key];
  if (mappedEvent === "JsonlTaskStarted") {
    snapshot.hadToolUse = false;
    return buildTransition(snapshot, mappedEvent);
  }
  if (mappedEvent && TOOL_USE_EVENTS.has(mappedEvent)) {
    snapshot.hadToolUse = true;
    return buildTransition(snapshot, mappedEvent);
  }
  if (mappedEvent === "JsonlTurnAborted") {
    snapshot.hadToolUse = false;
    if (snapshot.pendingApprovalTimer) {
      clearTimeout(snapshot.pendingApprovalTimer);
      snapshot.pendingApprovalTimer = undefined;
    }
    snapshot.pendingApprovalDetail = null;
    return buildTransition(snapshot, mappedEvent);
  }
  if (mappedEvent) return buildTransition(snapshot, mappedEvent);
  if (key !== "event_msg:task_complete") {
    return null;
  }

  const transition = buildTransition(
    snapshot,
    snapshot.hadToolUse ? "JsonlTaskComplete" : "JsonlTaskCompleteIdle",
  );
  snapshot.hadToolUse = false;
  return transition;
}

export function createPermissionTransition(snapshot: CodexJsonlSnapshot, approvalDelayMs: number): CodexJsonlTransition | null {
  if (!snapshot.sessionId || !snapshot.pendingApprovalDetail) return null;
  const transition = buildTransition(snapshot, "JsonlPermissionRequest", {
    permissionDetail: snapshot.pendingApprovalDetail,
  });
  snapshot.pendingApprovalTimer = setTimeout(() => {
    snapshot.pendingApprovalTimer = undefined;
    snapshot.pendingApprovalDetail = null;
  }, approvalDelayMs);
  return transition;
}

export function clearPendingApproval(snapshot: CodexJsonlSnapshot): void {
  if (snapshot.pendingApprovalTimer) {
    clearTimeout(snapshot.pendingApprovalTimer);
    snapshot.pendingApprovalTimer = undefined;
  }
  snapshot.pendingApprovalDetail = null;
}

export function setPendingApproval(snapshot: CodexJsonlSnapshot, payload: JsonRecord): void {
  const command = extractShellCommand(payload);
  if (command) {
    snapshot.pendingApprovalDetail = { command, rawPayload: payload };
  }
}
