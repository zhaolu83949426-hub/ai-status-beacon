import { contextBridge, ipcRenderer } from "electron";
import type { BeaconApi, AppSettings, BeaconSnapshot, PermissionDecision, AccountQuotaSnapshot, HookSyncResult, DashboardSessionView } from "../../shared/types";

const api: BeaconApi = {
  getSettings() {
    return ipcRenderer.invoke("getSettings");
  },
  saveSettings(settings: AppSettings) {
    return ipcRenderer.invoke("saveSettings", settings);
  },
  getBeaconSnapshot() {
    return ipcRenderer.invoke("getBeaconSnapshot");
  },
  onBeaconSnapshot(listener) {
    const handler = (_: unknown, snapshot: BeaconSnapshot) => listener(snapshot);
    ipcRenderer.on("beacon-snapshot", handler);
    return () => ipcRenderer.removeListener("beacon-snapshot", handler);
  },
  getDashboardSessions(): Promise<DashboardSessionView[]> {
    return ipcRenderer.invoke("getDashboardSessions");
  },
  getPendingPermissions(): Promise<any[]> {
    return ipcRenderer.invoke("getPendingPermissions");
  },
  decidePermission(id: string, decision: PermissionDecision): Promise<void> {
    return ipcRenderer.invoke("decidePermission", id, decision);
  },
  refreshQuota(accountId: string): Promise<AccountQuotaSnapshot> {
    return ipcRenderer.invoke("refreshQuota", accountId);
  },
  syncAgentHook(agentId: string): Promise<HookSyncResult> {
    return ipcRenderer.invoke("syncAgentHook", agentId);
  },
  toggleSound(enabled: boolean): Promise<void> {
    return ipcRenderer.invoke("toggleSound", enabled);
  },
};

contextBridge.exposeInMainWorld("beaconApi", api);
