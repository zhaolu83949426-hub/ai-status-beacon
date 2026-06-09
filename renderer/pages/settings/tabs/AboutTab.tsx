export function AboutTab() {
  return (
    <div className="settings-section about-section">
      <div className="about-logo">
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
          🚦
        </div>
      </div>
      <h2 className="about-title">AI Status Beacon</h2>
      <p className="about-version">版本 0.1.0</p>
      <p className="about-desc">
        跨平台桌面状态栏工具，持续展示 AI Agent 执行状态与账号额度。
      </p>
      <div className="about-links">
        <a
          href="https://github.com/open-sprout/ai-status-beacon"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link"
        >
          GitHub
        </a>
      </div>
      <div className="about-qr">
        <p className="about-qr-label">赞赏支持</p>
        <div className="about-qr-placeholder">
          {/* QR code image placeholder */}
          <span>二维码</span>
        </div>
      </div>
    </div>
  );
}
