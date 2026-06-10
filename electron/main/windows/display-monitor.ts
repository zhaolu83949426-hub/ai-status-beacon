import { screen, BrowserWindow } from "electron";
import type { SettingsStore } from "../settings/settings-store";
import { computeBounds, type GeometryConfig } from "./status-bar-geometry";

export function startDisplayMonitor(
  mainWindow: BrowserWindow,
  settings: SettingsStore,
  getGeometryConfig: () => GeometryConfig,
): () => void {
  const reposition = () => {
    if (mainWindow.isDestroyed()) return;
    const placement = settings.get().statusBar.placement;
    const bounds = computeBounds(placement, getGeometryConfig());
    mainWindow.setBounds(bounds);
  };

  screen.on("display-added", reposition);
  screen.on("display-removed", reposition);
  screen.on("display-metrics-changed", reposition);

  return () => {
    screen.removeListener("display-added", reposition);
    screen.removeListener("display-removed", reposition);
    screen.removeListener("display-metrics-changed", reposition);
  };
}
