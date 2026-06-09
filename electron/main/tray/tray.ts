import { Tray, Menu, nativeImage, app } from "electron";
import { join } from "path";

let tray: Tray | null = null;
let trayMenu: Menu | null = null;

export function createTray(handlers: {
  onToggleSound: () => boolean;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
}): Tray {
  const icon = getTrayIcon();
  tray = new Tray(icon);

  trayMenu = Menu.buildFromTemplate([
    {
      label: "音效",
      type: "checkbox",
      checked: true,
      click: (item) => {
        handlers.onToggleSound();
        item.checked = !item.checked;
      },
    },
    { type: "separator" },
    {
      label: "Dashboard",
      click: handlers.onOpenDashboard,
    },
    {
      label: "设置",
      click: handlers.onOpenSettings,
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("AI Status Beacon");
  tray.setContextMenu(trayMenu);

  // Left-click opens dashboard
  tray.on("click", handlers.onOpenDashboard);

  return tray;
}

export function updateTraySoundChecked(checked: boolean): void {
  if (!tray) return;
  if (trayMenu?.items[0]) {
    trayMenu.items[0].checked = checked;
  }
}

function getTrayIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "icons", "tray-icon-16.png")
    : join(process.cwd(), "assets", "icons", "tray-icon-16.png");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? nativeImage.createEmpty() : icon;
}
