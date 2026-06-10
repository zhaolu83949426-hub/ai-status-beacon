import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/glassmorphism.css";
import { StatusBar } from "../pages/status-bar/StatusBar";
import { ApprovalPage } from "../pages/approval/ApprovalPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { SettingsPage } from "../pages/settings/SettingsPage";

let previewAudio: HTMLAudioElement | null = null;
const AUDIO_WARMUP_STALE_MS = 10000;
const AUDIO_WARMUP_DELAY_MS = 50;
const AUDIO_WARMUP_VOLUME = 0.001;
let lastAudioWarmupAt = 0;

function reportSoundPlaybackError(phase: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "unknown");
  console.warn(`[sound:${phase}] ${message}`);
}

function warmAudioOutput(url: string): Promise<void> {
  const now = Date.now();
  if (now - lastAudioWarmupAt < AUDIO_WARMUP_STALE_MS) {
    return Promise.resolve();
  }
  lastAudioWarmupAt = now;
  const primer = new Audio(url);
  primer.preload = "auto";
  primer.volume = AUDIO_WARMUP_VOLUME;
  return primer.play()
    .then(() => new Promise<void>((resolve) => {
      window.setTimeout(() => {
        try {
          primer.pause();
        } catch {
          // ignore pause errors during warmup
        }
        resolve();
      }, AUDIO_WARMUP_DELAY_MS);
    }))
    .catch((err) => {
      reportSoundPlaybackError("warmup", err);
    });
}

function playSoundPayload(payload: { url: string; volume?: number }) {
  if (!payload?.url) {
    return;
  }
  previewAudio?.pause();
  const audio = new Audio(payload.url);
  audio.preload = "auto";
  audio.volume = typeof payload.volume === "number" ? Math.max(0, Math.min(1, payload.volume)) : 1;
  audio.currentTime = 0;
  previewAudio = audio;
  void warmAudioOutput(payload.url).then(() => {
    audio.play().catch((err) => reportSoundPlaybackError("play", err));
  });
}

window.beaconApi?.onPlaySound(playSoundPayload);

function Router() {
  const hash = window.location.hash.replace("#", "");

  if (!window.beaconApi) {
    return (
      <div style={{ padding: 40, color: "#f87171", fontFamily: "sans-serif", background: "#18181b", height: "100vh" }}>
        <h2>初始化失败</h2>
        <p>window.beaconApi 未定义 — preload 脚本未加载。</p>
        <p>hash: {hash}</p>
        <p>URL: {window.location.href}</p>
      </div>
    );
  }

  // Set body class for status bar (transparent) vs other pages (opaque)
  const isStatusBar = !hash;
  document.body.className = isStatusBar ? "statusbar-mode" : "";
  document.documentElement.className = isStatusBar ? "statusbar-mode" : "";

  switch (hash) {
    case "approval":
      return <ApprovalPage />;
    case "dashboard":
      return <DashboardPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <StatusBar />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
