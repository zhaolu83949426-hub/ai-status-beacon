import { EventEmitter } from "events";
import type { AccountQuotaSnapshot, BeaconState, AgentStateEvent, AgentSession, BeaconSnapshot } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";
import { mapEventToBeaconState } from "./state-mapper";

const STATE_PRIORITY: Record<BeaconState, number> = {
  idle: 0,
  working: 1,
  error: 2,
  approval: 3,
};

const MAX_SESSIONS = 50;
const STALE_SESSION_MS = 10 * 60 * 1000; // 10 minutes

type SnapshotListener = (snapshot: BeaconSnapshot) => void;

export class StateStore extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private settings: SettingsStore;
  private quotaSlots: AccountQuotaSnapshot[] = [];
  private staleTimer?: ReturnType<typeof setInterval>;

  constructor(settings: SettingsStore) {
    super();
    this.settings = settings;
    this.staleTimer = setInterval(() => this.cleanStaleSessions(), 60_000);
  }

  handleStateEvent(event: AgentStateEvent): void {
    const key = `${event.agentId}:${event.sessionId}`;
    const beaconState = mapEventToBeaconState(event.agentId, event.event);
    const now = Date.now();

    const existing = this.sessions.get(key);
    if (existing) {
      existing.state = beaconState;
      existing.lastEvent = event.event;
      if (event.cwd) existing.cwd = event.cwd;
      if (event.model) existing.model = event.model;
      if (event.provider) existing.provider = event.provider;
      if (event.sourcePid) existing.sourcePid = event.sourcePid;
      if (event.agentPid) existing.agentPid = event.agentPid;
      existing.updatedAt = now;
    } else {
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = [...this.sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
        if (oldest) this.sessions.delete(oldest[0]);
      }
      const session: AgentSession = {
        id: event.sessionId,
        agentId: event.agentId,
        state: beaconState,
        lastEvent: event.event,
        cwd: event.cwd ?? "",
        startedAt: now,
        updatedAt: now,
        sourcePid: event.sourcePid,
        agentPid: event.agentPid,
        model: event.model,
        provider: event.provider,
      };
      this.sessions.set(key, session);
    }

    this.emitSnapshot();
  }

  setSessionState(agentId: string, sessionId: string, state: BeaconState): void {
    const key = `${agentId}:${sessionId}`;
    const session = this.sessions.get(key);
    if (session) {
      session.state = state;
      session.updatedAt = Date.now();
      this.emitSnapshot();
    }
  }

  getAggregatedState(): BeaconState {
    let highest: BeaconState = "idle";
    for (const session of this.sessions.values()) {
      if (STATE_PRIORITY[session.state] > STATE_PRIORITY[highest]) {
        highest = session.state;
      }
    }
    return highest;
  }

  getSessions(): AgentSession[] {
    return [...this.sessions.values()];
  }

  updateQuotaSlots(quotaSlots: AccountQuotaSnapshot[]): void {
    this.quotaSlots = quotaSlots;
    this.emitSnapshot();
  }

  getSnapshot(pendingPermissionCount = 0): BeaconSnapshot {
    const settings = this.settings.get();
    return {
      state: this.getAggregatedState(),
      lightMode: settings.statusBar.lightMode,
      placement: settings.statusBar.placement,
      pendingPermissionCount,
      quotaSlots: this.quotaSlots,
    };
  }

  destroy(): void {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.removeAllListeners();
  }

  private cleanStaleSessions(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, session] of this.sessions) {
      if (now - session.updatedAt > STALE_SESSION_MS && session.state !== "idle") {
        session.state = "idle";
        session.updatedAt = now;
        changed = true;
      }
    }
    // Remove idle sessions older than double stale time
    for (const [key, session] of this.sessions) {
      if (now - session.updatedAt > STALE_SESSION_MS * 2 && session.state === "idle") {
        this.sessions.delete(key);
        changed = true;
      }
    }
    if (changed) this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.emit("snapshot-changed");
  }
}
