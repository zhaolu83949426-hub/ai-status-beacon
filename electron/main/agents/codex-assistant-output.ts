const ASSISTANT_OUTPUT_MAX = 2200;
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001F\u007F-\u009F]+/g;

const SKIP_RESPONSE_ITEM_TYPES = new Set([
  "function_call",
  "function_call_output",
  "custom_tool_call",
  "custom_tool_call_output",
  "web_search_call",
  "reasoning",
  "local_shell_call",
  "tool_call",
  "tool_result",
]);

const TEXT_RESPONSE_ITEM_TYPES = new Set([
  "message",
  "agent_message",
  "assistant_message",
  "output_text",
  "text",
]);

function normalizeAssistantOutputText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_RE, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

interface ClampedOutput {
  text: string;
  truncated: boolean;
}

function clampAssistantOutputText(text: unknown, maxLen: number = ASSISTANT_OUTPUT_MAX): ClampedOutput | null {
  const normalized = normalizeAssistantOutputText(text);
  const max = Number.isInteger(maxLen) && maxLen > 0 ? maxLen : ASSISTANT_OUTPUT_MAX;
  if (!normalized) return null;
  if (normalized.length <= max) return { text: normalized, truncated: false };

  const marker = "\n...[truncated]...\n";
  if (max <= marker.length + 20) {
    return { text: normalized.slice(Math.max(0, normalized.length - max)), truncated: true };
  }
  const keep = max - marker.length;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return {
    text: `${normalized.slice(0, head)}${marker}${normalized.slice(normalized.length - tail)}`,
    truncated: true,
  };
}

function textPartsFromContent(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (!block || typeof block !== "object") continue;
    const type = typeof block.type === "string" ? block.type : "";
    if (SKIP_RESPONSE_ITEM_TYPES.has(type)) continue;
    if ((type === "text" || type === "output_text" || type === "") && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts;
}

function collectTextCandidates(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const candidates: string[] = [];
  const obj = value as Record<string, unknown>;
  for (const key of ["content", "text", "output_text", "message", "delta"]) {
    if (!(key in obj)) continue;
    const raw = obj[key];
    if (typeof raw === "string") candidates.push(raw);
    else if (Array.isArray(raw)) candidates.push(...textPartsFromContent(raw));
    else if (raw && typeof raw === "object") {
      candidates.push(...collectTextCandidates(raw));
    }
  }
  return candidates;
}

function responseItemLooksAssistantText(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;
  const type = typeof obj.type === "string" ? obj.type : "";
  if (SKIP_RESPONSE_ITEM_TYPES.has(type)) return false;
  const role = typeof obj.role === "string" ? obj.role.toLowerCase() : "";
  if (role && role !== "assistant") return false;
  if (TEXT_RESPONSE_ITEM_TYPES.has(type)) return true;
  return role === "assistant";
}

function extractAssistantTextFromRecord(record: unknown): string {
  if (!record || typeof record !== "object") return "";
  const obj = record as Record<string, unknown>;
  const payload = obj.payload && typeof obj.payload === "object" ? obj.payload as Record<string, unknown> : null;
  if (!payload) return "";

  if (obj.type === "event_msg" && payload.type === "agent_message") {
    return normalizeAssistantOutputText(collectTextCandidates(payload).join("\n\n"));
  }

  if (obj.type !== "response_item") return "";
  if (!responseItemLooksAssistantText(payload)) return "";
  return normalizeAssistantOutputText(collectTextCandidates(payload).join("\n\n"));
}

export {
  ASSISTANT_OUTPUT_MAX,
  clampAssistantOutputText,
  extractAssistantTextFromRecord,
};