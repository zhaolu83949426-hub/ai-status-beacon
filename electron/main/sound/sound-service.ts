import { app, BrowserWindow } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import type { BeaconState } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";

const SOUND_FILENAME_BY_EVENT = {
  taskCompletePath: "complete.mp3",
  approvalPath: "confirm.mp3",
  errorPath: "error.mp3",
} as const;

type SoundEventKey = keyof typeof SOUND_FILENAME_BY_EVENT;

// Sound service plays audio files for state transitions.
// Uses a hidden BrowserWindow with <audio> element for cross-platform playback.

let soundWindow: BrowserWindow | null = null;
let soundWindowReady: Promise<BrowserWindow> | null = null;

function createSoundWindow(): BrowserWindow {
  if (soundWindow && !soundWindow.isDestroyed()) return soundWindow;

  soundWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Minimal HTML with audio playback capability
  soundWindow.loadURL(`data:text/html,<html><body><script>
    window.playSound = function(src) {
      var a = new Audio(src);
      a.volume = 0.6;
      a.play().catch(function(){});
    };
  </script></body></html>`);

  return soundWindow;
}

function getSoundWindow(): Promise<BrowserWindow> {
  if (soundWindow && !soundWindow.isDestroyed() && !soundWindow.webContents.isLoadingMainFrame()) {
    return Promise.resolve(soundWindow);
  }
  if (soundWindowReady) {
    return soundWindowReady;
  }
  const win = createSoundWindow();
  soundWindowReady = new Promise((resolve) => {
    const finish = () => {
      soundWindowReady = null;
      resolve(win);
    };
    if (win.webContents.isLoadingMainFrame()) {
      win.webContents.once("did-finish-load", finish);
      win.webContents.once("did-fail-load", finish);
      return;
    }
    finish();
  });
  return soundWindowReady;
}

export class SoundService {
  private settings: SettingsStore;
  private prevState: BeaconState = "idle";
  private prevPendingCount = 0;

  constructor(settings: SettingsStore) {
    this.settings = settings;
  }

  onStateChange(newState: BeaconState): void {
    const s = this.settings.get();
    if (!s.sound.enabled) {
      this.prevState = newState;
      return;
    }

    // Task complete: working → idle
    if (this.prevState === "working" && newState === "idle") {
      this.playEvent("taskCompletePath", s.sound.taskCompletePath);
    }

    // Error: any → error
    if (newState === "error" && this.prevState !== "error") {
      this.playEvent("errorPath", s.sound.errorPath);
    }

    this.prevState = newState;
  }

  onPendingChange(count: number): void {
    const s = this.settings.get();
    if (!s.sound.enabled) {
      this.prevPendingCount = count;
      return;
    }

    // Approval needed: 0 → 1
    if (this.prevPendingCount === 0 && count > 0) {
      this.playEvent("approvalPath", s.sound.approvalPath);
    }

    this.prevPendingCount = count;
  }

  preview(eventKey: SoundEventKey, customPath?: string | null): void {
    void this.playEvent(eventKey, customPath ?? this.settings.get().sound[eventKey]);
  }

  getPreviewUrl(eventKey: SoundEventKey, customPath?: string | null): string | null {
    const soundPath = this.getPreviewPath(eventKey, customPath);
    if (!soundPath) {
      return null;
    }
    return pathToFileURL(soundPath).href;
  }

  getPreviewPath(eventKey: SoundEventKey, customPath?: string | null): string | null {
    const defaultPath = this.getDefaultSoundPath(SOUND_FILENAME_BY_EVENT[eventKey]);
    const soundPath = customPath && existsSync(customPath) ? customPath : defaultPath;
    if (!soundPath || !existsSync(soundPath)) {
      return null;
    }
    return soundPath;
  }

  private async playEvent(eventKey: SoundEventKey, customPath: string | null): Promise<void> {
    const src = this.getPreviewUrl(eventKey, customPath);
    if (!src) {
      return;
    }
    const win = await getSoundWindow();
    if (win.isDestroyed()) {
      return;
    }

    win.webContents.executeJavaScript(`playSound(${JSON.stringify(src)})`).catch(() => {});
  }

  private getDefaultSoundPath(filename: string): string {
    // 仅打包后从 extraResources 读取；开发环境读取项目 assets 目录。
    if (app.isPackaged) {
      return join(process.resourcesPath, "sounds", filename);
    }
    return join(process.cwd(), "assets", "sounds", filename);
  }

  destroy(): void {
    if (soundWindow && !soundWindow.isDestroyed()) {
      soundWindow.close();
    }
    soundWindow = null;
    soundWindowReady = null;
  }
}
