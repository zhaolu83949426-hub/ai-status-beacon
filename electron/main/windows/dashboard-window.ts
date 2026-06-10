import { app, BrowserWindow, nativeImage } from "electron";
import { join } from "path";

let dashboardWindow: BrowserWindow | null = null;

function getAppIcon() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "icons", "icon-32.png")
    : join(process.cwd(), "assets", "icons", "icon-32.png");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

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
    autoHideMenuBar: true,
    icon: getAppIcon(),
    title: "AI Status Beacon — Dashboard",
    backgroundColor: "#1c1c1f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#dashboard`);
  } else {
    dashboardWindow.loadFile(join(__dirname, "../renderer/index.html"), { hash: "dashboard" });
  }

  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });

  return dashboardWindow;
}
