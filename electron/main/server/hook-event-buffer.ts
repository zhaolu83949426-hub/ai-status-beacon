const HOOK_EVENT_RING_SIZE_PER_AGENT = 50;
const HOOK_EVENT_OUTCOMES = new Set(["accepted", "dropped-by-disabled", "dropped-by-dnd"]);
const HOOK_EVENT_ROUTES = new Set(["state", "permission"]);

interface HookEvent {
  timestamp: number;
  agentId: string;
  eventType: string | null;
  route: string;
  outcome: string;
}

function normalizeHookEventAgentId(data: Record<string, unknown>): string {
  const explicit = data.agent_id ?? data.agentId;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const hookSource = data.hook_source;
  const mapping: Record<string, string> = {
    "antigravity-hook": "antigravity-cli",
    "codex-official": "codex",
    "copilot-hook": "copilot-cli",
    "opencode-plugin": "opencode",
    "openclaw-plugin": "openclaw",
    "pi-extension": "pi",
  };
  if (typeof hookSource === "string" && hookSource in mapping) return mapping[hookSource];
  return "claude-code";
}

function normalizeHookEventType(data: Record<string, unknown>, route: string): string | null {
  if (route === "permission") return "PermissionRequest";
  return typeof data.event === "string" && data.event ? data.event : null;
}

function recordHookEventInBuffer(
  buffer: Map<string, HookEvent[]>,
  data: Record<string, unknown>,
  route: string,
  outcome: string,
  options: { now?: () => number; ringSize?: number } = {},
): HookEvent | null {
  if (!buffer || !HOOK_EVENT_ROUTES.has(route) || !HOOK_EVENT_OUTCOMES.has(outcome)) return null;
  const agentId = normalizeHookEventAgentId(data);
  const timestamp = typeof options.now === "function" ? options.now() : Date.now();
  const event: HookEvent = {
    timestamp,
    agentId,
    eventType: normalizeHookEventType(data, route),
    route,
    outcome,
  };
  const ringSize = Number.isInteger(options.ringSize) && options.ringSize! > 0
    ? options.ringSize!
    : HOOK_EVENT_RING_SIZE_PER_AGENT;
  const list = buffer.get(agentId) || [];
  list.push(event);
  while (list.length > ringSize) list.shift();
  buffer.set(agentId, list);
  return event;
}

function getRecentHookEventsFromBuffer(
  buffer: Map<string, HookEvent[]>,
  options: { since?: number; agentId?: string } = {},
): HookEvent[] {
  if (!buffer) return [];
  const since = Number.isFinite(options.since) ? options.since! : null;
  const agentId = typeof options.agentId === "string" && options.agentId ? options.agentId : null;
  const source = agentId ? [buffer.get(agentId) || []] : Array.from(buffer.values());
  return source
    .flatMap((events) => Array.isArray(events) ? events : [])
    .filter((event) => !since || event.timestamp >= since)
    .map((event) => ({ ...event }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

interface SingleRequestRecorder {
  record: (route: string, outcome: string) => HookEvent | null;
  accepted: (route?: string) => HookEvent | null;
  droppedByDisabled: (route?: string) => HookEvent | null;
  droppedByDnd: (route?: string) => HookEvent | null;
  acceptedUnlessDnd: (dropForDnd: boolean, route?: string) => HookEvent | null;
}

function createSingleRequestHookEventRecorder(
  recordFn: (data: Record<string, unknown>, route: string, outcome: string) => HookEvent | null,
  data: Record<string, unknown>,
  defaultRoute: string,
): SingleRequestRecorder {
  let recorded = false;
  function record(route: string, outcome: string): HookEvent | null {
    const routeToUse = route || defaultRoute;
    if (recorded || !HOOK_EVENT_ROUTES.has(routeToUse) || !HOOK_EVENT_OUTCOMES.has(outcome)) return null;
    recorded = true;
    return recordFn(data, routeToUse, outcome);
  }
  return {
    record,
    accepted: (route?: string) => record(route || defaultRoute, "accepted"),
    droppedByDisabled: (route?: string) => record(route || defaultRoute, "dropped-by-disabled"),
    droppedByDnd: (route?: string) => record(route || defaultRoute, "dropped-by-dnd"),
    acceptedUnlessDnd: (dropForDnd: boolean, route?: string) =>
      dropForDnd ? record(route || defaultRoute, "dropped-by-dnd") : record(route || defaultRoute, "accepted"),
  };
}

export {
  HOOK_EVENT_RING_SIZE_PER_AGENT,
  createSingleRequestHookEventRecorder,
  recordHookEventInBuffer,
  getRecentHookEventsFromBuffer,
};
export type { HookEvent, SingleRequestRecorder };