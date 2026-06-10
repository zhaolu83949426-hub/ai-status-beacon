import { BrowserWindow, Menu } from "electron";
import { join } from "path";
import type { StatusBarBounds } from "../../../shared/types";

interface StatusBarWindowOptions {
  bounds?: StatusBarBounds;
  onSettings?: () => void;
}

function applyWindowsStatusBarBehavior(win: BrowserWindow) {
  if (process.platform !== "win32") {
    return;
  }
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.setFocusable(false);
  // Windows 下透明 frameless 窗口获得焦点时 DWM 会渲染白色系统标题栏，
  // 通过 setIgnoreMouseEvents 彻底阻止鼠标交互产生焦点。设置入口已由系统托盘提供。
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on("focus", () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused === win) {
      win.blur();
    }
  });
}

function bindStatusBarDebugEvents(win: BrowserWindow) {
  win.webContents.on("console-message", (_e, level, message, _line, source) => {
    console.log(`[StatusBar ${level}] ${message} (${source}:${_line})`);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("[StatusBar] Render process gone:", details);
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error(`[StatusBar] Failed to load: ${code} ${desc}`);
  });
}

export function createStatusBarWindow(
  options: StatusBarWindowOptions = {},
): BrowserWindow {
  const bounds = options.bounds ?? { x: 100, y: 0, width: 340, height: 56 };
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    show: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: "#00000000",
    title: "",
    resizable: false,
    alwaysOnTop: true,
    focusable: process.platform !== "win32",
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowsStatusBarBehavior(win);

  // Windows 下用 showInactive 首次显示，避免窗口获得焦点后失焦导致 DWM 回填白色背景
  win.once("ready-to-show", () => {
    win.showInactive();
  });

  // macOS / Linux 保留右键菜单打开设置
  if (options.onSettings && process.platform !== "win32") {
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
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  bindStatusBarDebugEvents(win);

  return win;
}
