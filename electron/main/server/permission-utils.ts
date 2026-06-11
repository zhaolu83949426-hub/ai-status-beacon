import { createHash } from "crypto";

const PREVIEW_MAX = 500;
const TOOL_MATCH_STRING_MAX = 240;
const TOOL_MATCH_ARRAY_MAX = 16;
const TOOL_MATCH_OBJECT_KEYS_MAX = 32;
const TOOL_MATCH_DEPTH_MAX = 6;

function truncateDeep(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj;
  if (Array.isArray(obj)) return obj.map((v) => truncateDeep(v, depth + 1));
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = truncateDeep(v, depth + 1);
    return out;
  }
  return typeof obj === "string" && obj.length > PREVIEW_MAX
    ? obj.slice(0, PREVIEW_MAX) + "\u2026" : obj;
}

function normalizeToolMatchValue(value: unknown, depth = 0): unknown {
  if (depth > TOOL_MATCH_DEPTH_MAX) return null;
  if (Array.isArray(value)) {
    return value.slice(0, TOOL_MATCH_ARRAY_MAX).map((entry) => normalizeToolMatchValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort().slice(0, TOOL_MATCH_OBJECT_KEYS_MAX)) {
      out[key] = normalizeToolMatchValue((value as Record<string, unknown>)[key], depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    return value.length > TOOL_MATCH_STRING_MAX
      ? `${value.slice(0, Math.max(0, TOOL_MATCH_STRING_MAX - 1))}\u2026`
      : value;
  }
  return value;
}

function buildToolInputFingerprint(toolInput: unknown): string | null {
  if (!toolInput || typeof toolInput !== "object") return null;
  const normalized = normalizeToolMatchValue(toolInput);
  return createHash("sha1").update(JSON.stringify(normalized)).digest("hex");
}

function normalizeHookToolUseId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

interface PendingPermission {
  sessionId: string;
  toolName: string;
  toolUseId: string | null;
  toolInputFingerprint: string | null;
}

function findPendingPermissionForStateEvent(
  pendingPermissions: PendingPermission[],
  options: { sessionId?: string; toolUseId?: string | null; toolName?: string; toolInputFingerprint?: string; allowSingletonFallback?: boolean },
): PendingPermission | null {
  const sessionId = typeof options.sessionId === "string" && options.sessionId ? options.sessionId : "default";
  const sessionPending = pendingPermissions.filter((perm) => perm && perm.sessionId === sessionId);
  if (!sessionPending.length) return null;

  const toolUseId = normalizeHookToolUseId(options.toolUseId);
  if (toolUseId) {
    const matchByToolUseId = sessionPending.find((perm) => perm.toolUseId === toolUseId);
    if (matchByToolUseId) return matchByToolUseId;
  }

  const toolName = typeof options.toolName === "string" && options.toolName ? options.toolName : null;
  const toolInputFingerprint = typeof options.toolInputFingerprint === "string" && options.toolInputFingerprint
    ? options.toolInputFingerprint
    : null;
  if (toolName && toolInputFingerprint) {
    const matchesByFingerprint = sessionPending.filter((perm) =>
      perm.toolName === toolName && perm.toolInputFingerprint === toolInputFingerprint && (!toolUseId || !perm.toolUseId)
    );
    if (matchesByFingerprint.length === 1) return matchesByFingerprint[0];
  }

  return options.allowSingletonFallback && sessionPending.length === 1 ? sessionPending[0] : null;
}

export {
  PREVIEW_MAX,
  TOOL_MATCH_STRING_MAX,
  truncateDeep,
  normalizeToolMatchValue,
  buildToolInputFingerprint,
  normalizeHookToolUseId,
  findPendingPermissionForStateEvent,
};
export type { PendingPermission };