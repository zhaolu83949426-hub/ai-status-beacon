import { ipcMain, BrowserWindow, dialog } from "electron";
import { extname } from "path";
import { readFileSync } from "fs";
import type { AgentSettings, PermissionDecision, AppSettings, QuotaAccountFormData } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";
import type { StateStore } from "../state/state-store";
import type { PermissionStore } from "../permission/permission-store";
import type { BeaconServer } from "../server/http-server";
import type { QuotaService } from "../quota/quota-service";
import type { SoundService } from "../sound/sound-service";
import { getAgent, listAgentMetadata } from "../agents/registry";
import { HookSyncService } from "../hooks/hook-sync";
import { QuotaAccountService } from "../quota/quota-account-service";
import * as updater from "../updater/updater";

const SOUND_KEYS = new Set(["taskCompletePath", "approvalPath", "errorPath"]);
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
};

function isHookFlag(flag: keyof AgentSettings): boolean {
  return flag === "stateEnabled" || flag === "permissionEnabled";
}

function shouldSyncHooks(agentSettings: AgentSettings): boolean {
  return agentSettings.stateEnabled || agentSettings.permissionEnabled;
}

export function registerIpcHandlers(
  settings: SettingsStore,
  stateStore: StateStore,
  permissionStore: PermissionStore,
  server: BeaconServer,
  quotaService: QuotaService,
  soundService: SoundService,
): void {
  const quotaAccountService = new QuotaAccountService(settings);

  ipcMain.handle("getSettings", async () => {
    return settings.get();
  });

  ipcMain.handle("saveSettings", async (_e, newSettings: AppSettings) => {
    return settings.save(newSettings);
  });

  ipcMain.handle("listAgents", async () => {
    const port = server.getPort();
    const hookSync = port ? new HookSyncService(port, settings.get().agents) : null;
    const hookStatusByAgent = Object.fromEntries(
      Object.entries(settings.get().agents).map(([agentId, agentSettings]) => {
        let status = hookSync?.getHookStatus(agentId).hookStatus ?? "error";
        if (hookSync && shouldSyncHooks(agentSettings) && status === "outdated") {
          status = hookSync.syncAgent(agentId).hookStatus;
        }
        return [agentId, status];
      }),
    );
    return listAgentMetadata(hookStatusByAgent);
  });

  ipcMain.handle(
    "setAgentFlag",
    async (_e, agentId: string, flag: keyof AgentSettings, value: boolean) => {
      const current = settings.get();
      const agents = { ...current.agents };
      agents[agentId] = { ...agents[agentId], [flag]: value };
      const saved = settings.save({ ...current, agents });

      if (flag === "stateEnabled" && !value) {
        stateStore.clearSessionsByAgent(agentId);
        permissionStore.closeByAgent(agentId);
      }
      if (flag === "permissionEnabled" && !value) {
        permissionStore.closeByAgent(agentId);
      }
      if (isHookFlag(flag) && server.getPort()) {
        const port = server.getPort();
        if (port) new HookSyncService(port, saved.agents).syncAgent(agentId);
      }
      return saved;
    },
  );

  ipcMain.handle("saveQuotaAccount", async (_e, input: QuotaAccountFormData) => {
    return quotaAccountService.saveAccount(input);
  });

  ipcMain.handle("deleteQuotaAccount", async (_e, accountId: string) => {
    return quotaAccountService.deleteAccount(accountId);
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

  ipcMain.handle("refreshQuota", async (_e, accountId: string) => {
    const account = settings.get().quota.accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new Error("账号不存在");
    }
    return quotaService.queryAccount(account);
  });

  ipcMain.handle("toggleSound", async (_e, enabled: boolean) => {
    const current = settings.get();
    settings.save({ ...current, sound: { ...current.sound, enabled } });
  });

  ipcMain.handle("pickSoundFile", async (event, eventKey: keyof AppSettings["sound"]) => {
    if (!SOUND_KEYS.has(eventKey)) {
      throw new Error("不支持的音效类型");
    }
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(parent, {
      title: "选择音效文件",
      properties: ["openFile"],
      filters: [{ name: "音频文件", extensions: AUDIO_EXTENSIONS }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    const ext = extname(selectedPath).slice(1).toLowerCase();
    if (!AUDIO_EXTENSIONS.includes(ext)) {
      throw new Error("仅支持常见音频格式文件");
    }
    return selectedPath;
  });

  ipcMain.handle("previewSound", async (event, eventKey: keyof AppSettings["sound"], customPath?: string | null) => {
    if (!SOUND_KEYS.has(eventKey)) {
      throw new Error("不支持的音效类型");
    }
    const soundPath = soundService.getPreviewPath(eventKey, customPath ?? null);
    if (!soundPath) {
      return;
    }
    const ext = extname(soundPath).slice(1).toLowerCase();
    const mime = AUDIO_MIME_BY_EXT[ext];
    if (!mime) {
      return;
    }
    const base64 = readFileSync(soundPath).toString("base64");
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow || senderWindow.isDestroyed()) {
      return;
    }
    const payload = { url: `data:${mime};base64,${base64}`, volume: 0.6 };
    senderWindow.webContents.send("play-sound", payload);
  });

  // ── Updater IPC ──
  ipcMain.handle("updater:check", async () => {
    return updater.checkForUpdates(true);
  });

  ipcMain.handle("updater:download", async () => {
    return updater.downloadUpdate();
  });

  ipcMain.handle("updater:install", async () => {
    updater.quitAndInstall();
  });

  ipcMain.handle("updater:getStatus", async () => {
    return updater.getCurrentStatus();
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
