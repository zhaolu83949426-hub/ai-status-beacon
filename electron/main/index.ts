import { app, BrowserWindow, ipcMain } from "electron";
import { SettingsStore } from "./settings/settings-store";
import { StateStore } from "./state/state-store";
import { PermissionStore } from "./permission/permission-store";
import { BeaconServer } from "./server/http-server";
import { registerIpcHandlers } from "./ipc/ipc-handlers";
import { createStatusBarWindow } from "./windows/status-bar-window";
import { startDisplayMonitor } from "./windows/display-monitor";
import { initRegistry, getDefaultAgentSettings } from "./agents/registry";
import { HookSyncService } from "./hooks/hook-sync";
import { createTray } from "./tray/tray";
import { computeBounds } from "./windows/status-bar-geometry";
import { getOrCreateDashboardWindow } from "./windows/dashboard-window";
import { getOrCreateApprovalWindow, closeApprovalWindow, registerApprovalHotkeys } from "./windows/approval-window";
import { getOrCreateSettingsWindow } from "./windows/settings-window";
import { getAgent } from "./agents/registry";
import { SoundService } from "./sound/sound-service";
import { setAutoLaunch } from "./settings/auto-launch";
import { getLogger } from "./utils/logger";
import { QuotaService } from "./quota/quota-service";

const log = getLogger();

let mainWindow: BrowserWindow | null = null;
let settings: SettingsStore;
let stateStore: StateStore;
let permissionStore: PermissionStore;
let soundService: SoundService;
let quotaService: QuotaService;

function bootstrap() {
  log.info("business", "Application starting...");

  // 1. Initialize agent registry
  initRegistry();

  // 2. Load settings and merge default agent settings
  settings = new SettingsStore();
  const current = settings.get();
  const defaultAgents = getDefaultAgentSettings();
  const mergedAgents = { ...defaultAgents, ...current.agents };
  if (JSON.stringify(mergedAgents) !== JSON.stringify(current.agents)) {
    settings.save({ ...current, agents: mergedAgents });
  }

  // 3. Auto launch
  if (current.startup.enabled) {
    setAutoLaunch(true);
  }

  // 4. Create state and permission stores
  stateStore = new StateStore(settings);
  permissionStore = new PermissionStore(stateStore);

  // 5. Start HTTP server
  const server = new BeaconServer(stateStore, permissionStore, settings);
  server.start().then(() => {
    log.info("server", `HTTP server started on port ${server.getPort()}`);
    // 6. Sync hooks for enabled agents
    const hookSync = new HookSyncService(server.getPort()!);
    const agentSettings = settings.get().agents;
    for (const [agentId, agentConfig] of Object.entries(agentSettings)) {
      if (agentConfig.stateEnabled) {
        const result = hookSync.syncAgent(agentId);
        log.info("agent", `Hook sync ${agentId}: ${result.hookStatus}`);
      }
    }
  });

  // 7. Create sound service
  soundService = new SoundService(settings);

  // 8. Register IPC handlers
  registerIpcHandlers(settings, stateStore, permissionStore, server);

  // 9. Additional IPC: pending permissions list
  ipcMain.handle("getPendingPermissions", async () => {
    return permissionStore.getPending().map((p) => {
      const agent = getAgent(p.agentId);
      return { ...p, agentName: agent?.name ?? p.agentId };
    });
  });

  // 10. Sound triggers on state change
  stateStore.on("snapshot-changed", () => {
    const newState = stateStore.getAggregatedState();
    soundService.onStateChange(newState);
  });

  // 11. When permission arrives, show approval window + sound
  permissionStore.on("permission-added", () => {
    soundService.onPendingChange(permissionStore.getPendingCount());
    getOrCreateApprovalWindow();
  });

  // 12. When all permissions resolved, close approval window
  permissionStore.on("permission-removed", () => {
    soundService.onPendingChange(permissionStore.getPendingCount());
    if (permissionStore.getPendingCount() === 0) {
      closeApprovalWindow();
    }
  });

  // 13. Register approval hotkeys
  const unregisterHotkeys = registerApprovalHotkeys(
    () => {
      const pending = permissionStore.getPending();
      if (pending.length > 0) {
        permissionStore.resolve(pending[0].id, { behavior: "allow" });
      }
    },
    () => {
      const pending = permissionStore.getPending();
      if (pending.length > 0) {
        permissionStore.resolve(pending[0].id, { behavior: "deny" });
      }
    },
  );

  // 14. Create status bar window
  const s = settings.get();
  const quotaSlotCount = [s.quota.displaySlots.slot1AccountId, s.quota.displaySlots.slot2AccountId]
    .filter(Boolean)
    .length;
  const bounds = computeBounds(s.statusBar.placement, {
    lightMode: s.statusBar.lightMode,
    quotaSlotCount,
  });
  mainWindow = createStatusBarWindow({
    bounds,
    onSettings: () => getOrCreateSettingsWindow(),
  });

  // 15. Start display monitor
  const stopMonitor = startDisplayMonitor(mainWindow, settings, {
    lightMode: s.statusBar.lightMode,
    quotaSlotCount,
  });

  // 16. Create system tray
  createTray({
    onToggleSound: () => {
      const cur = settings.get();
      settings.save({ ...cur, sound: { ...cur.sound, enabled: !cur.sound.enabled } });
      return cur.sound.enabled;
    },
    onOpenSettings: () => getOrCreateSettingsWindow(),
    onOpenDashboard: () => getOrCreateDashboardWindow(),
  });

  // 17. Start quota refresh
  quotaService = new QuotaService();
  quotaService.startPeriodicRefresh(
    s.quota.refreshIntervalMinutes,
    () => settings.get().quota.accounts,
    () => settings.get().quota.displaySlots,
    (snapshots) => stateStore.updateQuotaSlots(snapshots),
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopMonitor();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      log.info("business", "Application shutting down...");
      unregisterHotkeys();
      quotaService.stopPeriodicRefresh();
      soundService.destroy();
      server.stop();
      permissionStore.closeAll();
      stateStore.destroy();
      app.quit();
    }
  });

  app.on("activate", () => {
    if (!mainWindow) {
      mainWindow = createStatusBarWindow();
    }
  });

  log.info("business", "Application started successfully");
}

app.whenReady().then(bootstrap);

app.on("before-quit", () => {
  // Cleanup handled in window-all-closed
});
