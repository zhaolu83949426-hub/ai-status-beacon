import { app, BrowserWindow, nativeImage } from "electron";
import { join } from "path";

let settingsWindow: BrowserWindow | null = null;

function getAppIcon() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "icons", "icon-32.png")
    : join(process.cwd(), "assets", "icons", "icon-32.png");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

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
    autoHideMenuBar: true,
    icon: getAppIcon(),
    title: "AI Status Beacon — 设置",
    backgroundColor: "#2c2c31",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#settings`);
  } else {
    settingsWindow.loadFile(join(__dirname, "../renderer/index.html"), { hash: "settings" });
  }

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}
