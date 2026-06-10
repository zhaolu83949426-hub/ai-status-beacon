import type { BeaconState } from "../../../shared/types";

const agentEventMaps = new Map<string, Record<string, BeaconState>>();

function normalizeEventName(event: string): string {
  return event.replace(/[\s_-]+/g, "").toLowerCase();
}

function matchNormalizedEvent(
  eventMap: Record<string, BeaconState>,
  event: string,
): BeaconState | undefined {
  const normalizedEvent = normalizeEventName(event);
  for (const [name, state] of Object.entries(eventMap)) {
    if (normalizeEventName(name) === normalizedEvent) return state;
  }
  return undefined;
}

export function registerAgentEventMap(agentId: string, map: Record<string, BeaconState>): void {
  agentEventMaps.set(agentId, map);
}

export function mapEventToBeaconState(agentId: string, event: string): BeaconState {
  const agentMap = agentEventMaps.get(agentId);
  if (!agentMap) return "idle";
  if (event in agentMap) return agentMap[event];
  return matchNormalizedEvent(agentMap, event) ?? "idle";
}
