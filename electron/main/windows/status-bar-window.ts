import { BrowserWindow, Menu } from "electron";
import { join } from "path";
import type { StatusBarBounds } from "../../../shared/types";

interface StatusBarWindowOptions {
  bounds?: StatusBarBounds;
  onSettings?: () => void;
}

export function createStatusBarWindow(
  options: StatusBarWindowOptions = {},
): BrowserWindow {
  const bounds = options.bounds ?? { x: 100, y: 0, width: 280, height: 48 };

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Windows: use pop-up-menu level to stay above most windows
  if (process.platform === "win32") {
    win.setAlwaysOnTop(true, "pop-up-menu");
  }

  // Right-click context menu — "Settings" only
  if (options.onSettings) {
    win.webContents.on("context-menu", () => {
      Menu.buildFromTemplate([
        { label: "设置", click: options.onSettings },
      ]).popup();
    });
  }

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../../renderer/index.html"));
  }

  return win;
}
