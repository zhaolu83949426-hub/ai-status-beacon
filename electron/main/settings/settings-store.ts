import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { join } from "path";
import type { AppSettings, StatusBarPlacement } from "../../../shared/types";

const SETTINGS_FILE = "settings.json";
const MAX_BACKUP_ATTEMPTS = 3;

function defaultPlacement(): StatusBarPlacement {
  return { edge: "top", displayId: "primary", offsetRatio: 0.5 };
}

export function createDefaultSettings(): AppSettings {
  return {
    statusBar: {
      placement: defaultPlacement(),
      lightMode: "triple",
    },
    startup: {
      enabled: false,
    },
    sound: {
      enabled: true,
      taskCompletePath: null,
      approvalPath: null,
      errorPath: null,
    },
    agents: {},
    quota: {
      accounts: [],
      displaySlots: { slot1AccountId: null, slot2AccountId: null },
      refreshIntervalMinutes: 5,
    },
  };
}

function settingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE);
}

function tempPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE + ".tmp");
}

function atomicWrite(filePath: string, data: string): void {
  const tmp = tempPath();
  writeFileSync(tmp, data, "utf-8");
  renameSync(tmp, filePath);
}

type SettingsChangeListener = (settings: AppSettings) => void;

export class SettingsStore {
  private data: AppSettings;
  private listeners: SettingsChangeListener[] = [];

  constructor() {
    this.data = this.load();
  }

  private load(): AppSettings {
    const path = settingsPath();
    if (!existsSync(path)) {
      return createDefaultSettings();
    }
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      return this.mergeWithDefaults(parsed);
    } catch {
      return createDefaultSettings();
    }
  }

  private mergeWithDefaults(partial: Record<string, unknown>): AppSettings {
    const defaults = createDefaultSettings();
    return {
      statusBar: {
        placement: (partial.statusBar as Record<string, unknown>)?.placement as StatusBarPlacement ?? defaults.statusBar.placement,
        lightMode: (partial.statusBar as Record<string, unknown>)?.lightMode as "single" | "triple" ?? defaults.statusBar.lightMode,
      },
      startup: {
        enabled: (partial.startup as Record<string, unknown>)?.enabled as boolean ?? defaults.startup.enabled,
      },
      sound: {
        enabled: (partial.sound as Record<string, unknown>)?.enabled as boolean ?? defaults.sound.enabled,
        taskCompletePath: (partial.sound as Record<string, unknown>)?.taskCompletePath as string | null ?? defaults.sound.taskCompletePath,
        approvalPath: (partial.sound as Record<string, unknown>)?.approvalPath as string | null ?? defaults.sound.approvalPath,
        errorPath: (partial.sound as Record<string, unknown>)?.errorPath as string | null ?? defaults.sound.errorPath,
      },
      agents: this.mergeAgentSettings(partial.agents as Record<string, unknown> | undefined, defaults.agents),
      quota: {
        accounts: (partial.quota as Record<string, unknown>)?.accounts as AppSettings["quota"]["accounts"] ?? defaults.quota.accounts,
        displaySlots: (partial.quota as Record<string, unknown>)?.displaySlots as AppSettings["quota"]["displaySlots"] ?? defaults.quota.displaySlots,
        refreshIntervalMinutes: (partial.quota as Record<string, unknown>)?.refreshIntervalMinutes as number ?? defaults.quota.refreshIntervalMinutes,
      },
    };
  }

  private mergeAgentSettings(
    partialAgents: Record<string, unknown> | undefined,
    defaults: AppSettings["agents"],
  ): AppSettings["agents"] {
    const merged: AppSettings["agents"] = {};
    const agentIds = new Set([...Object.keys(defaults), ...Object.keys(partialAgents ?? {})]);
    for (const agentId of agentIds) {
      const defaultSettings = defaults[agentId] ?? { stateEnabled: false, permissionEnabled: false };
      const partial = partialAgents?.[agentId] as Record<string, unknown> | undefined;
      merged[agentId] = {
        stateEnabled: partial?.stateEnabled as boolean ?? defaultSettings.stateEnabled,
        permissionEnabled: partial?.permissionEnabled as boolean ?? defaultSettings.permissionEnabled,
      };
    }
    return merged;
  }

  get(): AppSettings {
    return this.data;
  }

  save(settings: AppSettings): AppSettings {
    this.data = settings;
    try {
      atomicWrite(settingsPath(), JSON.stringify(settings, null, 2));
    } catch (err) {
      console.error("[SettingsStore] Failed to save settings:", err);
    }
    this.listeners.forEach((fn) => fn(this.data));
    return this.data;
  }

  onChange(listener: SettingsChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
