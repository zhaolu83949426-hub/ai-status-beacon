import { contextBridge, ipcRenderer } from "electron";
import type {
  BeaconApi,
  AppSettings,
  BeaconSnapshot,
  PermissionDecision,
  AccountQuotaSnapshot,
  DashboardSessionView,
  QuotaAccountFormData,
  UpdateProgress,
} from "../../shared/types";

const api: BeaconApi = {
  getSettings() {
    return ipcRenderer.invoke("getSettings");
  },
  saveSettings(settings: AppSettings) {
    return ipcRenderer.invoke("saveSettings", settings);
  },
  listAgents() {
    return ipcRenderer.invoke("listAgents");
  },
  setAgentFlag(agentId, flag, value) {
    return ipcRenderer.invoke("setAgentFlag", agentId, flag, value);
  },
  saveQuotaAccount(input: QuotaAccountFormData) {
    return ipcRenderer.invoke("saveQuotaAccount", input);
  },
  deleteQuotaAccount(accountId: string) {
    return ipcRenderer.invoke("deleteQuotaAccount", accountId);
  },
  getBeaconSnapshot() {
    return ipcRenderer.invoke("getBeaconSnapshot");
  },
  onBeaconSnapshot(listener) {
    const handler = (_: unknown, snapshot: BeaconSnapshot) => listener(snapshot);
    ipcRenderer.on("beacon-snapshot", handler);
    return () => ipcRenderer.removeListener("beacon-snapshot", handler);
  },
  onPlaySound(listener) {
    const handler = (_: unknown, payload: { url: string; volume?: number }) => listener(payload);
    ipcRenderer.on("play-sound", handler);
    return () => ipcRenderer.removeListener("play-sound", handler);
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
  toggleSound(enabled: boolean): Promise<void> {
    return ipcRenderer.invoke("toggleSound", enabled);
  },
  pickSoundFile(eventKey) {
    return ipcRenderer.invoke("pickSoundFile", eventKey);
  },
  previewSound(eventKey, customPath) {
    return ipcRenderer.invoke("previewSound", eventKey, customPath);
  },
  checkForUpdates(): Promise<UpdateProgress> {
    return ipcRenderer.invoke("updater:check");
  },
  downloadUpdate(): Promise<void> {
    return ipcRenderer.invoke("updater:download");
  },
  installUpdate(): Promise<void> {
    return ipcRenderer.invoke("updater:install");
  },
  getUpdateStatus(): Promise<UpdateProgress> {
    return ipcRenderer.invoke("updater:getStatus");
  },
  onUpdateStatus(listener) {
    const handler = (_: unknown, progress: UpdateProgress) => listener(progress);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke("getAppVersion");
  },
};

contextBridge.exposeInMainWorld("beaconApi", api);
