import type { AppSettings, StatusBarPlacement } from "../../../../shared/types";

const EDGES: { value: StatusBarPlacement["edge"]; label: string }[] = [
  { value: "top", label: "上方" },
  { value: "bottom", label: "下方" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
];

export function GeneralTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  return (
    <div className="section">
      <div className="card">
        <div className="section-title">状态栏位置</div>
        <div className="radio-group" style={{ marginTop: 8 }}>
          {EDGES.map((e) => (
            <button
              key={e.value}
              className={`radio-btn ${settings.statusBar.placement.edge === e.value ? "active" : ""}`}
              onClick={() =>
                onSave({
                  ...settings,
                  statusBar: {
                    ...settings.statusBar,
                    placement: { ...settings.statusBar.placement, edge: e.value },
                  },
                })
              }
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">红绿灯形态</div>
        <div className="radio-group" style={{ marginTop: 8 }}>
          <button
            className={`radio-btn ${settings.statusBar.lightMode === "single" ? "active" : ""}`}
            onClick={() =>
              onSave({ ...settings, statusBar: { ...settings.statusBar, lightMode: "single" } })
            }
          >
            单灯
          </button>
          <button
            className={`radio-btn ${settings.statusBar.lightMode === "triple" ? "active" : ""}`}
            onClick={() =>
              onSave({ ...settings, statusBar: { ...settings.statusBar, lightMode: "triple" } })
            }
          >
            三灯
          </button>
        </div>
      </div>

      <div className="card">
        <div className="field-row">
          <label>开机自启动</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.startup.enabled}
              onChange={(e) =>
                onSave({ ...settings, startup: { enabled: e.target.checked } })
              }
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>
    </div>
  );
}
