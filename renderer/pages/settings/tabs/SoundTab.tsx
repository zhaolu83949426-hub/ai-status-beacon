import type { AppSettings } from "../../../../shared/types";

const SOUND_EVENTS = [
  { key: "taskCompletePath" as const, label: "任务完成" },
  { key: "approvalPath" as const, label: "等待审批" },
  { key: "errorPath" as const, label: "错误提醒" },
];

export function SoundTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  return (
    <div className="settings-section">
      <div className="settings-field">
        <label>音效总开关</label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.sound.enabled}
            onChange={(e) =>
              onSave({ ...settings, sound: { ...settings.sound, enabled: e.target.checked } })
            }
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {SOUND_EVENTS.map((event) => (
        <div key={event.key} className="settings-field">
          <label>{event.label}</label>
          <div className="sound-row">
            <input
              className="settings-input"
              type="text"
              placeholder="默认音效"
              value={settings.sound[event.key] ?? ""}
              maxLength={260}
              onChange={(e) =>
                onSave({
                  ...settings,
                  sound: {
                    ...settings.sound,
                    [event.key]: e.target.value || null,
                  },
                })
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
