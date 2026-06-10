import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { getLogger } from "../utils/logger";
import type { UpdateProgress } from "../../../shared/types";

const log = getLogger();

type UpdateStatus = UpdateProgress["status"];
type StatusListener = (progress: UpdateProgress) => void;

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 3 * 60 * 1000;
const PROGRESS_THROTTLE_MS = 500;

let currentStatus: UpdateStatus = "idle";
let latestVersion = "";
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let listeners: StatusListener[] = [];
let lastProgressPush = 0;

function notifyAll() {
  const progress: UpdateProgress = {
    status: currentStatus,
    latestVersion: latestVersion || undefined,
  };
  for (const fn of listeners) {
    try {
      fn(progress);
    } catch {}
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("updater:status", progress);
    }
  }
}

function compareVersions(v1: string, v2: string): number {
  const p1 = String(v1).replace(/^v/, "").split(".").map((s) => parseInt(s, 10) || 0);
  const p2 = String(v2).replace(/^v/, "").split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export function initUpdater(): void {
  if (!app.isPackaged) {
    log.info("updater", "开发模式，跳过自动更新初始化");
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const newVer = info.version;
    if (compareVersions(newVer, app.getVersion()) > 0) {
      currentStatus = "available";
      latestVersion = newVer;
      log.info("updater", `发现新版本: v${newVer}`);
      notifyAll();
    } else {
      currentStatus = "up-to-date";
      notifyAll();
    }
  });

  autoUpdater.on("update-not-available", () => {
    currentStatus = "up-to-date";
    notifyAll();
  });

  autoUpdater.on("download-progress", (progress) => {
    currentStatus = "downloading";
    const now = Date.now();
    if (now - lastProgressPush < PROGRESS_THROTTLE_MS) return;
    lastProgressPush = now;

    const pct = Math.round(progress.percent);
    const payload: UpdateProgress = {
      status: "downloading",
      latestVersion: latestVersion || undefined,
      downloadProgress: pct,
    };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("updater:status", payload);
      }
    }
  });

  autoUpdater.on("update-downloaded", () => {
    currentStatus = "downloaded";
    log.info("updater", "新版本下载完成，等待用户重启安装");
    notifyAll();
  });

  autoUpdater.on("error", (err) => {
    const msg = err?.message || "未知错误";
    if (msg.includes("404") || msg.includes("Cannot find latest")) {
      currentStatus = "up-to-date";
    } else {
      currentStatus = "error";
      log.error("updater", `更新检查失败: ${msg}`);
    }
    notifyAll();
  });

  startScheduler();
}

export async function checkForUpdates(): Promise<UpdateProgress> {
  if (!app.isPackaged) {
    return { status: "up-to-date" };
  }

  if (currentStatus === "checking") {
    return getCurrentStatus();
  }

  currentStatus = "checking";
  notifyAll();

  try {
    await autoUpdater.checkForUpdates();
  } catch (err: any) {
    currentStatus = "error";
    log.error("updater", err?.message || "检查更新失败");
    notifyAll();
  }

  return getCurrentStatus();
}

export async function downloadUpdate(): Promise<void> {
  if (currentStatus !== "available") return;
  try {
    await autoUpdater.downloadUpdate();
  } catch (err: any) {
    currentStatus = "error";
    log.error("updater", `下载更新失败: ${err?.message}`);
    notifyAll();
  }
}

export function quitAndInstall(): void {
  if (currentStatus !== "downloaded") return;
  autoUpdater.quitAndInstall();
}

export function onStatusChange(fn: StatusListener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getCurrentStatus(): UpdateProgress {
  return {
    status: currentStatus,
    latestVersion: latestVersion || undefined,
  };
}

function startScheduler(): void {
  const doCheck = () => {
    if (currentStatus === "downloading" || currentStatus === "downloaded" || currentStatus === "checking") return;
    checkForUpdates().catch(() => {});
  };

  initialTimer = setTimeout(() => {
    initialTimer = null;
    doCheck();
    intervalTimer = setInterval(doCheck, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  log.info("updater", `定时检查已启动，首次检查 ${INITIAL_DELAY_MS / 1000}s 后，之后每 ${CHECK_INTERVAL_MS / 3600000}h`);
}

export function stopScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
