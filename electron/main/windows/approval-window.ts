import { BrowserWindow, globalShortcut } from "electron";
import { join } from "path";

let approvalWindow: BrowserWindow | null = null;

export function getOrCreateApprovalWindow(): BrowserWindow {
  if (approvalWindow && !approvalWindow.isDestroyed()) {
    approvalWindow.show();
    approvalWindow.focus();
    return approvalWindow;
  }

  approvalWindow = new BrowserWindow({
    width: 520,
    height: 600,
    minWidth: 400,
    minHeight: 200,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "AI Status Beacon — Approval",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === "win32") {
    approvalWindow.setAlwaysOnTop(true, "floating");
  }

  // Load approval page — we use a hash route in the same renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    approvalWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#approval`);
  } else {
    approvalWindow.loadFile(join(__dirname, "../renderer/index.html"), { hash: "approval" });
  }

  approvalWindow.on("closed", () => {
    approvalWindow = null;
  });

  return approvalWindow;
}

export function closeApprovalWindow(): void {
  if (approvalWindow && !approvalWindow.isDestroyed()) {
    approvalWindow.close();
  }
}

// Global hotkeys for quick approve/deny
const ACCELERATOR_ALLOW = "CommandOrControl+Shift+A";
const ACCELERATOR_DENY = "CommandOrControl+Shift+D";

export function registerApprovalHotkeys(
  onAllow: () => void,
  onDeny: () => void,
): () => void {
  globalShortcut.register(ACCELERATOR_ALLOW, onAllow);
  globalShortcut.register(ACCELERATOR_DENY, onDeny);

  return () => {
    globalShortcut.unregister(ACCELERATOR_ALLOW);
    globalShortcut.unregister(ACCELERATOR_DENY);
  };
}
