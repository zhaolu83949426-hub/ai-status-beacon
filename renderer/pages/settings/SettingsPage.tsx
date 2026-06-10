import { useState, useEffect } from "react";
import type { AppSettings } from "../../../shared/types";
import { GeneralTab } from "./tabs/GeneralTab";
import { AgentsTab } from "./tabs/AgentsTab";
import { AccountsTab } from "./tabs/AccountsTab";
import { SoundTab } from "./tabs/SoundTab";
import { AboutTab } from "./tabs/AboutTab";

const TABS = [
  { key: "general", label: "通用", icon: "⚙" },
  { key: "agents", label: "Agent", icon: "🤖" },
  { key: "accounts", label: "账号", icon: "👤" },
  { key: "sound", label: "音效", icon: "🔔" },
  { key: "about", label: "关于", icon: "ℹ" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.beaconApi.getSettings()
      .then(setSettings)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <div className="app-layout">
        <div className="content-area empty-state" style={{ color: "var(--red)" }}>
          加载设置失败: {error}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="app-layout">
        <div className="content-area empty-state">加载中...</div>
      </div>
    );
  }

  const save = (updated: AppSettings) => {
    setSettings(updated);
    window.beaconApi.saveSettings(updated);
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`sidebar-item ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="content-area">
        {activeTab === "general" && <GeneralTab settings={settings} onSave={save} />}
        {activeTab === "agents" && <AgentsTab settings={settings} onSave={setSettings} />}
        {activeTab === "accounts" && <AccountsTab settings={settings} onSave={setSettings} />}
        {activeTab === "sound" && <SoundTab settings={settings} onSave={save} />}
        {activeTab === "about" && <AboutTab />}
      </main>
    </div>
  );
}
