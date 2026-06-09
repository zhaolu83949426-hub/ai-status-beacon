import { useState } from "react";
import type { AppSettings } from "../../../shared/types";
import { GeneralTab } from "./tabs/GeneralTab";
import { AgentsTab } from "./tabs/AgentsTab";
import { AccountsTab } from "./tabs/AccountsTab";
import { SoundTab } from "./tabs/SoundTab";
import { AboutTab } from "./tabs/AboutTab";
import "../../styles/glassmorphism.css";

const TABS = [
  { key: "general", label: "通用" },
  { key: "agents", label: "Agent" },
  { key: "accounts", label: "账号" },
  { key: "sound", label: "音效" },
  { key: "about", label: "关于" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [settings, setSettings] = useState<AppSettings | null>(null);

  if (!settings) {
    window.beaconApi.getSettings().then(setSettings);
    return <div className="settings-container">Loading...</div>;
  }

  const save = (updated: AppSettings) => {
    setSettings(updated);
    window.beaconApi.saveSettings(updated);
  };

  return (
    <div className="settings-container">
      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`settings-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-content">
        {activeTab === "general" && <GeneralTab settings={settings} onSave={save} />}
        {activeTab === "agents" && <AgentsTab settings={settings} onSave={save} />}
        {activeTab === "accounts" && <AccountsTab settings={settings} onSave={save} />}
        {activeTab === "sound" && <SoundTab settings={settings} onSave={save} />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
}
