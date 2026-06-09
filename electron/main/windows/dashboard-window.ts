import { BrowserWindow } from "electron";
import { join } from "path";

let dashboardWindow: BrowserWindow | null = null;

export function getOrCreateDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return dashboardWindow;
  }

  dashboardWindow = new BrowserWindow({
    width: 800,
    height: 500,
    minWidth: 600,
    minHeight: 300,
    frame: true,
    transparent: false,
    resizable: true,
    title: "AI Status Beacon — Dashboard",
    backgroundColor: "#18181b",
    webPreferences: {
      preload: join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#dashboard`);
  } else {
    dashboardWindow.loadFile(join(__dirname, "../../renderer/index.html"), { hash: "dashboard" });
  }

  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });

  return dashboardWindow;
}
