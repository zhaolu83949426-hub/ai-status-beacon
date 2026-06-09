import { BrowserWindow } from "electron";
import { join } from "path";

let settingsWindow: BrowserWindow | null = null;

export function getOrCreateSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 600,
    minWidth: 560,
    minHeight: 400,
    frame: true,
    transparent: false,
    resizable: true,
    title: "AI Status Beacon — 设置",
    backgroundColor: "#18181b",
    webPreferences: {
      preload: join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#settings`);
  } else {
    settingsWindow.loadFile(join(__dirname, "../../renderer/index.html"), { hash: "settings" });
  }

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}
