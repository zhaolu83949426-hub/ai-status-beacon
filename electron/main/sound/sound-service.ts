import { BrowserWindow } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import type { BeaconState } from "../../../shared/types";
import type { SettingsStore } from "../settings/settings-store";

// Sound service plays audio files for state transitions.
// Uses a hidden BrowserWindow with <audio> element for cross-platform playback.

let soundWindow: BrowserWindow | null = null;

function getSoundWindow(): BrowserWindow {
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
      this.play(s.sound.taskCompletePath);
    }

    // Error: any → error
    if (newState === "error" && this.prevState !== "error") {
      this.play(s.sound.errorPath);
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
      this.play(s.sound.approvalPath);
    }

    this.prevPendingCount = count;
  }

  private play(customPath: string | null): void {
    const win = getSoundWindow();
    const defaultPath = this.getDefaultSoundPath("task-complete.wav");

    let src: string;
    if (customPath && existsSync(customPath)) {
      src = `file://${customPath.replace(/\\/g, "/")}`;
    } else if (defaultPath && existsSync(defaultPath)) {
      src = `file://${defaultPath.replace(/\\/g, "/")}`;
    } else {
      return;
    }

    win.webContents.executeJavaScript(`playSound("${src}")`).catch(() => {});
  }

  private getDefaultSoundPath(filename: string): string {
    // In production, sounds are in extraResources
    if (process.resourcesPath) {
      return join(process.resourcesPath, "sounds", filename);
    }
    return join(process.cwd(), "assets", "sounds", filename);
  }

  destroy(): void {
    if (soundWindow && !soundWindow.isDestroyed()) {
      soundWindow.close();
    }
    soundWindow = null;
  }
}
