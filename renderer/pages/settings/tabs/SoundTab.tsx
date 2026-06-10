import { useState } from "react";
import type { AppSettings } from "../../../../shared/types";

const SOUND_EVENTS = [
  { key: "taskCompletePath" as const, label: "任务完成", defaultName: "内置 complete.mp3" },
  { key: "approvalPath" as const, label: "等待审批", defaultName: "内置 confirm.mp3" },
  { key: "errorPath" as const, label: "错误提醒", defaultName: "内置 error.mp3" },
];

export function SoundTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [busyKey, setBusyKey] = useState<(typeof SOUND_EVENTS)[number]["key"] | null>(null);

  const updateSoundPath = (eventKey: (typeof SOUND_EVENTS)[number]["key"], value: string | null) => {
    onSave({
      ...settings,
      sound: {
        ...settings.sound,
        [eventKey]: value,
      },
    });
  };

  const pickFile = async (eventKey: (typeof SOUND_EVENTS)[number]["key"]) => {
    setBusyKey(eventKey);
    try {
      const selectedPath = await window.beaconApi.pickSoundFile(eventKey);
      if (selectedPath) {
        updateSoundPath(eventKey, selectedPath);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const previewSound = async (eventKey: (typeof SOUND_EVENTS)[number]["key"]) => {
    setBusyKey(eventKey);
    try {
      await window.beaconApi.previewSound(eventKey, settings.sound[eventKey]);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div className="field-row">
          <label>音效总开关</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sound.enabled}
              onChange={(e) =>
                onSave({ ...settings, sound: { ...settings.sound, enabled: e.target.checked } })
              }
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      {SOUND_EVENTS.map((event) => (
        <div key={event.key} className="card">
          <div className="field-row">
            <label>{event.label}</label>
            <span className="field-label-secondary">
              {settings.sound[event.key] ? "已自定义" : event.defaultName}
            </span>
          </div>
          <div className="sound-row" style={{ marginTop: 6 }}>
            <input
              className="text-input"
              type="text"
              placeholder={event.defaultName}
              value={settings.sound[event.key] ?? ""}
              maxLength={260}
              onChange={(e) =>
                updateSoundPath(event.key, e.target.value || null)
              }
            />
            <button className="btn btn-soft" onClick={() => pickFile(event.key)} disabled={busyKey === event.key}>
              选择文件
            </button>
            <button className="btn btn-soft" onClick={() => previewSound(event.key)} disabled={busyKey === event.key || !settings.sound.enabled}>
              试听
            </button>
            <button className="btn btn-soft" onClick={() => updateSoundPath(event.key, null)} disabled={busyKey === event.key || !settings.sound[event.key]}>
              恢复默认
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
