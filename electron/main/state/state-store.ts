import { EventEmitter } from "events";
import type { AccountQuotaSnapshot, BeaconState, AgentStateEvent, AgentSession, BeaconSnapshot } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";
import { mapEventToBeaconState } from "./state-mapper";
import { getLogger } from "../utils/logger";

const STATE_PRIORITY: Record<BeaconState, number> = {
  idle: 0,
  sleeping: 0,
  "codex-turn-end": 0,
  thinking: 1,
  working: 1,
  attention: 1,
  notification: 2,
  juggling: 1,
  sweeping: 1,
  carrying: 1,
  error: 2,
  approval: 3,
};

const MAX_SESSIONS = 50;
const CLEANUP_INTERVAL_MS = 5_000;
const THINKING_STALE_MS = 45_000;
const ACTIVE_SESSION_STALE_MS = 5 * 60 * 1000;
const STALE_SESSION_MS = 10 * 60 * 1000; // 10 minutes

const AUTO_RETURN_MS: Partial<Record<BeaconState, number>> = {
  attention: 4000,
  error: 5000,
  sweeping: 300000,
  notification: 5000,
  carrying: 3000,
};

const ONESHOT_STATES = new Set(["attention", "error", "sweeping", "notification", "carrying"]);

const log = getLogger();

type SnapshotListener = (snapshot: BeaconSnapshot) => void;

export class StateStore extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private settings: SettingsStore;
  private quotaSlots: AccountQuotaSnapshot[] = [];
  private staleTimer?: ReturnType<typeof setInterval>;
  private autoReturnTimer?: ReturnType<typeof setTimeout>;

  constructor(settings: SettingsStore) {
    super();
    this.settings = settings;
    this.staleTimer = setInterval(() => this.cleanStaleSessions(), CLEANUP_INTERVAL_MS);
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

    this.cleanStaleSessions(now, false);

    log.info("agent", "State updated", {
      agentId: event.agentId,
      sessionId: event.sessionId,
      event: event.event,
      mappedState: beaconState,
      aggregatedState: this.getAggregatedState(),
    });

    this.scheduleAutoReturn(beaconState);
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

  clearSessionsByAgent(agentId: string): void {
    let changed = false;
    for (const [key, session] of this.sessions) {
      if (session.agentId !== agentId) continue;
      this.sessions.delete(key);
      changed = true;
    }
    if (changed) this.emitSnapshot();
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
    if (this.autoReturnTimer) clearTimeout(this.autoReturnTimer);
    this.removeAllListeners();
  }

  private scheduleAutoReturn(state: BeaconState): void {
    const ms = AUTO_RETURN_MS[state];
    if (!ms) return;

    if (this.autoReturnTimer) {
      clearTimeout(this.autoReturnTimer);
    }

    this.autoReturnTimer = setTimeout(() => {
      this.autoReturnTimer = undefined;
      this.cleanupOneshotSessions();
      this.emitSnapshot();
    }, ms);
  }

  private cleanupOneshotSessions(): void {
    const now = Date.now();
    let changed = false;
    for (const session of this.sessions.values()) {
      if (ONESHOT_STATES.has(session.state)) {
        session.state = "idle";
        session.updatedAt = now;
        changed = true;
      }
    }
    if (changed) {
      log.info("agent", "Oneshot sessions cleaned up");
    }
  }

  private cleanStaleSessions(now = Date.now(), emitSnapshot = true): void {
    let changed = false;
    for (const [key, session] of this.sessions) {
      const age = now - session.updatedAt;
      if (session.state === "thinking" && age > THINKING_STALE_MS) {
        session.state = "idle";
        session.updatedAt = now;
        changed = true;
        continue;
      }
      if ((session.state === "working" || session.state === "juggling") && age > ACTIVE_SESSION_STALE_MS) {
        session.state = "idle";
        session.updatedAt = now;
        changed = true;
        continue;
      }
      if (age > STALE_SESSION_MS && session.state !== "idle") {
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
    if (changed && emitSnapshot) this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.emit("snapshot-changed");
  }
}
