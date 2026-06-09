import { EventEmitter } from "events";
import type { PendingPermission, PermissionRequest, PermissionDecision } from "../../../shared/types";
import type { StateStore } from "../state/state-store";

export class PermissionStore extends EventEmitter {
  private pending = new Map<string, PendingPermission>();
  // Resolvers for held HTTP responses: when user decides, we resolve the promise
  private resolvers = new Map<string, (decision: PermissionDecision) => void>();
  private stateStore: StateStore;

  constructor(stateStore: StateStore) {
    super();
    this.stateStore = stateStore;
  }

  enqueue(request: PermissionRequest): Promise<PermissionDecision> {
    const entry: PendingPermission = {
      ...request,
      status: "pending",
    };
    this.pending.set(request.id, entry);

    // Update sessions that have pending approvals
    this.stateStore.setSessionState(request.agentId, request.sessionId, "approval");

    this.emit("permission-added", entry);
    this.stateStore.emit("snapshot-changed");

    return new Promise<PermissionDecision>((resolve) => {
      this.resolvers.set(request.id, resolve);
    });
  }

  resolve(id: string, decision: PermissionDecision): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    entry.status = decision.behavior === "no-decision" ? "closed" : "resolved";
    this.pending.delete(id);

    const resolver = this.resolvers.get(id);
    if (resolver) {
      resolver(decision);
      this.resolvers.delete(id);
    }

    this.emit("permission-removed", id);
    this.stateStore.emit("snapshot-changed");
  }

  getPending(): PendingPermission[] {
    return [...this.pending.values()];
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  hasPendingForAgent(agentId: string): boolean {
    for (const p of this.pending.values()) {
      if (p.agentId === agentId) return true;
    }
    return false;
  }

  // Close all pending with no-decision (e.g., on app quit)
  closeAll(): void {
    for (const [id] of this.pending) {
      this.resolve(id, { behavior: "no-decision" });
    }
  }
}
