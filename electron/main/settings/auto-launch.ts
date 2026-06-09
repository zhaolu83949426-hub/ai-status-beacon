import { app } from "electron";

export function setAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath("exe"),
  });
}
