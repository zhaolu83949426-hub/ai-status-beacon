import { useState, useEffect, useCallback } from "react";
import type { UpdateProgress } from "../../../shared/types";

type UpdateStatus = UpdateProgress["status"];
const STATUS_LABEL: Record<UpdateStatus, string> = {
  idle: "",
  checking: "检查中",
  available: "可更新",
  downloading: "下载中",
  downloaded: "已就绪",
  "up-to-date": "最新版本",
  error: "更新失败",
};

export function AboutTab() {
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateProgress>({ status: "idle" });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.beaconApi.getAppVersion().then((v) => setVersion(v));
    window.beaconApi.getUpdateStatus().then((s) => setUpdate(s));
  }, []);

  useEffect(() => {
    const unsub = window.beaconApi.onUpdateStatus((progress) => {
      setUpdate(progress);
      if (progress.status !== "checking") {
        setChecking(false);
      }
    });
    return unsub;
  }, []);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await window.beaconApi.checkForUpdates();
      setUpdate(result);
    } catch {
      setUpdate({ status: "error" });
    } finally {
      setChecking(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      await window.beaconApi.downloadUpdate();
    } catch {
      setUpdate({ status: "error" });
    }
  }, []);

  const handleInstall = useCallback(async () => {
    await window.beaconApi.installUpdate();
  }, []);

  const renderUpdateBlock = () => {
    const { status, latestVersion, downloadProgress } = update;

    if (status === "idle" && !checking) {
      return (
        <button
          className="about-update-btn about-update-btn-check"
          onClick={handleCheck}
        >
          检查更新
        </button>
      );
    }

    if (checking || status === "checking") {
      return (
        <div className="about-update-status about-update-checking">
          <span className="about-update-spinner" />
          <span>正在检查更新…</span>
        </div>
      );
    }

    if (status === "up-to-date") {
      return (
        <div className="about-update-status about-update-uptodate">
          <span className="about-update-icon">✓</span>
          <span>已是最新版本</span>
        </div>
      );
    }

    if (status === "available") {
      return (
        <div className="about-update-status about-update-available">
          <span className="about-update-icon">🔵</span>
          <span className="about-update-version">
            发现新版本 v{latestVersion}
          </span>
          <button
            className="about-update-btn about-update-btn-download"
            onClick={handleDownload}
          >
            下载更新
          </button>
        </div>
      );
    }

    if (status === "downloading") {
      const pct = downloadProgress ?? 0;
      return (
        <div className="about-update-status about-update-downloading">
          <span className="about-update-icon">⬇️</span>
          <span>正在下载 v{latestVersion}</span>
          <div className="about-update-progress">
            <div
              className="about-update-progress-bar"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="about-update-pct">{pct}%</span>
        </div>
      );
    }

    if (status === "downloaded") {
      return (
        <div className="about-update-status about-update-downloaded">
          <span className="about-update-icon">✅</span>
          <span>v{latestVersion} 已下载</span>
          <button
            className="about-update-btn about-update-btn-install"
            onClick={handleInstall}
          >
            重启并安装
          </button>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="about-update-status about-update-error">
          <span className="about-update-icon">⚠️</span>
          <span>更新失败</span>
          <button
            className="about-update-btn about-update-btn-check"
            onClick={handleCheck}
          >
            重试
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="section about-section">
      <div className="about-logo">
        <div className="about-logo-circle">🚦</div>
      </div>
      <h2 className="about-title">AI Status Beacon</h2>
      <p className="about-version">版本 {version}</p>
      <p className="about-desc">
        跨平台桌面状态栏工具，持续展示 AI Agent 执行状态与账号额度。
      </p>

      <div className="about-update-card">
        <div className="about-update-header">
          <span className="about-update-label">在线更新</span>
          {update.status !== "idle" && !checking && (
            <span
              className={`about-update-pill about-update-pill-${update.status}`}
            >
              {STATUS_LABEL[update.status]}
            </span>
          )}
        </div>
        <div className="about-update-body">{renderUpdateBlock()}</div>
      </div>

      <div className="about-links">
        <a
          href="https://github.com/open-sprout/ai-status-beacon"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link"
        >
          GitHub →
        </a>
      </div>
      <div className="about-qr-label">赞赏支持</div>
      <div className="about-qr-placeholder">二维码</div>
    </div>
  );
}
