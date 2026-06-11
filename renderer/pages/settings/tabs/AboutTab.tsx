import { useState, useEffect, useCallback } from "react";
import type { UpdateProgress } from "../../../shared/types";
import logo from "../../../public/icon-256.png";

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

  const openLink = useCallback((url: string) => {
    window.beaconApi.openExternal(url);
  }, []);

  const renderUpdateBlock = () => {
    const { status, latestVersion, downloadProgress } = update;

    if (status === "idle" && !checking) {
      return (
        <button
          className="about-check-update-btn"
          onClick={handleCheck}
        >
          检查更新
        </button>
      );
    }

    if (checking || status === "checking") {
      return (
        <div className="about-update-status checking">
          <span className="about-update-spinner" />
          <span>正在检查更新…</span>
        </div>
      );
    }

    if (status === "up-to-date") {
      return (
        <div className="about-update-status uptodate">
          <span className="about-update-icon">✓</span>
          <span>已是最新版本</span>
        </div>
      );
    }

    if (status === "available") {
      return (
        <div className="about-update-status available">
          <span className="about-update-icon">🔵</span>
          <span className="about-update-version">
            发现新版本 v{latestVersion}
          </span>
          <button
            className="about-action-btn"
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
        <div className="about-update-status downloading">
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
        <div className="about-update-status downloaded">
          <span className="about-update-icon">✅</span>
          <span>v{latestVersion} 已下载</span>
          <button
            className="about-action-btn"
            onClick={handleInstall}
          >
            重启并安装
          </button>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="about-update-status error">
          <span className="about-update-icon">⚠️</span>
          <span>更新失败</span>
          <button
            className="about-action-btn"
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
      <div className="about-hero">
        <div className="about-logo-wrap">
          <img
            src={logo}
            alt="AI Status Beacon"
            className="about-logo-img"
          />
        </div>
        <h2 className="about-title">AI Status Beacon</h2>
        <p className="about-tagline">
          跨平台桌面状态栏工具，持续展示 AI Agent 执行状态与账号额度
        </p>
      </div>

      <div className="about-info-section">
        <div className="about-info-row">
          <span className="about-info-label">版本</span>
          <div className="about-info-value">
            <span>v{version || "?"}</span>
            {update.status !== "idle" && (
              <span className={`about-update-pill about-update-pill-${update.status}`}>
                {STATUS_LABEL[update.status]}
              </span>
            )}
          </div>
        </div>

        <div className="about-info-row">
          <span className="about-info-label">在线更新</span>
          <div className="about-info-value">
            {renderUpdateBlock()}
          </div>
        </div>

        <div className="about-info-row">
          <span className="about-info-label">开源地址</span>
          <div className="about-info-value">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openLink("https://github.com/open-sprout/ai-status-beacon");
              }}
            >
              github.com/open-sprout/ai-status-beacon
            </a>
          </div>
        </div>

        <div className="about-info-row">
          <span className="about-info-label">许可证</span>
          <div className="about-info-value">
            MIT License
          </div>
        </div>
      </div>

      <div className="about-footer">
        用 ❤️ 打造的 AI 辅助开发工具
      </div>
    </div>
  );
}
