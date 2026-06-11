import CodexSubagentClassifier from "../agents/codex-subagent-classifier";

const CODEX_OFFICIAL_HOOK_SOURCE = "codex-official";
const MAX_CODEX_OFFICIAL_TURNS = 200;
const CODEX_SESSION_ROLE_SUBAGENT = "subagent";

interface TurnEntry {
  sessionId: string;
  hadToolUse: boolean;
}

function pruneCodexOfficialTurns(turns: Map<string, TurnEntry>): void {
  if (turns.size <= MAX_CODEX_OFFICIAL_TURNS) return;
  const overflow = turns.size - MAX_CODEX_OFFICIAL_TURNS;
  let removed = 0;
  for (const key of Array.from(turns.keys())) {
    turns.delete(key);
    removed++;
    if (removed >= overflow) break;
  }
}

function getCodexOfficialTurnKey(sessionId: string | undefined, turnId: string | null): string | null {
  if (!turnId) return null;
  return `${sessionId || "default"}|${turnId}`;
}

function classifyCodexOfficialSession(data: Record<string, unknown>, classifier: CodexSubagentClassifier): string {
  const sessionId = typeof data.session_id === "string" && data.session_id ? data.session_id : "default";
  try {
    return classifier.registerSession(sessionId, {
      hookPayload: data,
      hookRole: data.codex_session_role,
    });
  } catch {
    return "unknown";
  }
}

interface CodexOfficialHookResult {
  state: string;
  drop: boolean;
  headless?: boolean;
}

function resolveCodexOfficialHookState(
  data: Record<string, unknown>,
  requestedState: string,
  turns: Map<string, TurnEntry>,
  classifier: CodexSubagentClassifier | null,
): CodexOfficialHookResult {
  const agentId = data.agent_id ?? data.agentId;
  if (!data || agentId !== "codex" || data.hook_source !== CODEX_OFFICIAL_HOOK_SOURCE) {
    return { state: requestedState, drop: false };
  }

  const event = typeof data.event === "string" ? data.event : "";
  const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : null;
  const sessionId = typeof data.session_id === "string" && data.session_id ? data.session_id : "default";
  const sessionRole = classifier ? classifyCodexOfficialSession(data, classifier) : "unknown";
  const isSubagent = sessionRole === CODEX_SESSION_ROLE_SUBAGENT;
  const headless = isSubagent ? { headless: true } : {};
  const turnKey = getCodexOfficialTurnKey(sessionId, turnId);

  if (event === "Stop" && data.stop_hook_active === true) {
    if (turnKey) turns.delete(turnKey);
    return { state: requestedState, drop: true, ...headless };
  }

  if (turnKey) {
    if (event === "UserPromptSubmit") {
      turns.set(turnKey, { sessionId, hadToolUse: false });
      pruneCodexOfficialTurns(turns);
    } else if (event === "PreToolUse" || event === "PostToolUse") {
      const current = turns.get(turnKey) || { sessionId, hadToolUse: false };
      current.sessionId = sessionId;
      current.hadToolUse = true;
      turns.set(turnKey, current);
      pruneCodexOfficialTurns(turns);
    } else if (event === "Stop") {
      const current = turns.get(turnKey);
      if (current) turns.delete(turnKey);
      if (isSubagent) return { state: "idle", drop: false, headless: true };
      return { state: current && current.hadToolUse ? "attention" : "idle", drop: false };
    }
  } else if (event === "Stop") {
    return { state: "idle", drop: false, ...headless };
  }

  return { state: requestedState, drop: false, ...headless };
}

export {
  CODEX_OFFICIAL_HOOK_SOURCE,
  MAX_CODEX_OFFICIAL_TURNS,
  pruneCodexOfficialTurns,
  resolveCodexOfficialHookState,
};
export type { TurnEntry };