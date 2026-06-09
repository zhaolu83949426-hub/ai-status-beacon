import { ipcMain, BrowserWindow } from "electron";
import type { PermissionDecision, AppSettings } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";
import type { StateStore } from "../state/state-store";
import type { PermissionStore } from "../permission/permission-store";
import type { BeaconServer } from "../server/http-server";
import { getAgent } from "../agents/registry";
import { HookSyncService } from "../hooks/hook-sync";

export function registerIpcHandlers(
  settings: SettingsStore,
  stateStore: StateStore,
  permissionStore: PermissionStore,
  server: BeaconServer,
): void {
  ipcMain.handle("getSettings", async () => {
    return settings.get();
  });

  ipcMain.handle("saveSettings", async (_e, newSettings: AppSettings) => {
    return settings.save(newSettings);
  });

  ipcMain.handle("getBeaconSnapshot", async () => {
    return stateStore.getSnapshot(permissionStore.getPendingCount());
  });

  ipcMain.handle("getDashboardSessions", async () => {
    return stateStore.getSessions().map((s) => {
      const agent = getAgent(s.agentId);
      return {
        agentId: s.agentId,
        agentName: agent?.name ?? s.agentId,
        state: s.state,
        lastEvent: s.lastEvent,
        cwd: s.cwd,
        startedAt: s.startedAt,
        updatedAt: s.updatedAt,
      };
    });
  });

  ipcMain.handle("decidePermission", async (_e, id: string, decision: PermissionDecision) => {
    permissionStore.resolve(id, decision);
  });

  ipcMain.handle("refreshQuota", async (_e, _accountId: string) => {
    // Stub — implemented in Phase 5
    return {
      accountId: _accountId,
      accountType: "claude_official" as const,
      success: false,
      credentialStatus: "not_found" as const,
      tiers: [],
      error: "Quota system not yet implemented",
      queriedAt: null,
    };
  });

  ipcMain.handle("syncAgentHook", async (_e, agentId: string) => {
    const port = server.getPort();
    if (!port) {
      return { agentId, installed: false, hookStatus: "error" as const, message: "Server not running" };
    }
    const hookSync = new HookSyncService(port);
    return hookSync.syncAgent(agentId);
  });

  ipcMain.handle("toggleSound", async (_e, enabled: boolean) => {
    const current = settings.get();
    settings.save({ ...current, sound: { ...current.sound, enabled } });
  });

  // Push snapshots to all renderer windows
  const pushSnapshot = () => {
    const snapshot = stateStore.getSnapshot(permissionStore.getPendingCount());
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("beacon-snapshot", snapshot);
      }
    }
  };

  stateStore.on("snapshot-changed", pushSnapshot);
  permissionStore.on("permission-added", pushSnapshot);
  permissionStore.on("permission-removed", pushSnapshot);
}
