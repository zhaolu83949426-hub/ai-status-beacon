import {
  ROLE_ROOT,
  ROLE_SUBAGENT,
  ROLE_UNKNOWN,
  classifyHookPayload,
  classifySessionMeta,
  normalizeRole,
} from "./codex-subagent-fields";

const DEFAULT_CAPACITY = 100;

interface ClassifierEntry {
  role: string;
}

interface SessionInput {
  hookRole?: unknown;
  hookPayload?: unknown;
  sessionMeta?: unknown;
}

class CodexSubagentClassifier {
  private _capacity: number;
  private _entries = new Map<string, ClassifierEntry>();

  constructor(options: { capacity?: number } = {}) {
    this._capacity = Number.isInteger(options.capacity) && options.capacity! > 0
      ? options.capacity!
      : DEFAULT_CAPACITY;
  }

  registerSession(sessionId: string, input: SessionInput = {}): string {
    const key = this._normalizeSessionId(sessionId);
    if (!key) return ROLE_UNKNOWN;

    const nextRole = this._classifyInput(input);
    const current = this._entries.get(key);
    const role = this._mergeRole(current?.role, nextRole);

    this._entries.delete(key);
    this._entries.set(key, { role });
    this._prune();
    return role;
  }

  classify(sessionId: string): string {
    const key = this._normalizeSessionId(sessionId);
    if (!key) return ROLE_UNKNOWN;
    const current = this._entries.get(key);
    if (!current) return ROLE_UNKNOWN;

    this._entries.delete(key);
    this._entries.set(key, current);
    return current.role || ROLE_UNKNOWN;
  }

  clear(sessionId: string): void {
    const key = this._normalizeSessionId(sessionId);
    if (!key) return;
    this._entries.delete(key);
  }

  private _classifyInput(input: SessionInput): string {
    const hookRole = normalizeRole(input.hookRole);
    if (hookRole !== ROLE_UNKNOWN) return hookRole;

    const hookPayloadRole = classifyHookPayload(input.hookPayload);
    if (hookPayloadRole !== ROLE_UNKNOWN) return hookPayloadRole;

    const sessionMetaRole = classifySessionMeta(input.sessionMeta);
    if (sessionMetaRole !== ROLE_UNKNOWN) return sessionMetaRole;

    return ROLE_UNKNOWN;
  }

  private _mergeRole(currentRole: string | undefined, nextRole: string): string {
    const current = normalizeRole(currentRole);
    const next = normalizeRole(nextRole);

    if (current === ROLE_SUBAGENT && next === ROLE_ROOT) return ROLE_SUBAGENT;
    if (next === ROLE_UNKNOWN) return current;
    if (current === ROLE_UNKNOWN) return next;
    if (current === ROLE_ROOT && next === ROLE_SUBAGENT) return ROLE_SUBAGENT;
    return current;
  }

  private _normalizeSessionId(sessionId: string): string | null {
    if (typeof sessionId !== "string") return null;
    const trimmed = sessionId.trim();
    return trimmed || null;
  }

  private _prune(): void {
    while (this._entries.size > this._capacity) {
      const first = this._entries.keys().next().value;
      this._entries.delete(first);
    }
  }
}

export default CodexSubagentClassifier;