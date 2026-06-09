import { useEffect, useState } from "react";
import type { BeaconSnapshot, BeaconState } from "../../../shared/types";
import { QuotaSlot } from "../../components/QuotaCircle";

const STATE_COLORS: Record<BeaconState, string> = {
  idle: "#4ade80",
  working: "#facc15",
  approval: "#fb923c",
  error: "#f87171",
};

export function StatusBar() {
  const [snapshot, setSnapshot] = useState<BeaconSnapshot | null>(null);

  useEffect(() => {
    window.beaconApi.getBeaconSnapshot().then(setSnapshot);
    const unsub = window.beaconApi.onBeaconSnapshot(setSnapshot);
    return unsub;
  }, []);

  if (!snapshot) return null;

  const state = snapshot.state;
  const color = STATE_COLORS[state];
  const isApproval = state === "approval";
  const hasQuota = snapshot.quotaSlots.length > 0;

  return (
    <div className="status-bar">
      <div className="traffic-light">
        {snapshot.lightMode === "single" ? (
          <div
            className={`light ${isApproval ? "flashing" : ""}`}
            style={{ backgroundColor: color }}
          />
        ) : (
          <div className="triple-lights">
            <div
              className="light"
              style={{ backgroundColor: "#f87171", opacity: state === "error" ? 1 : 0.2 }}
            />
            <div
              className={`light ${isApproval ? "flashing" : ""}`}
              style={{ backgroundColor: "#facc15", opacity: state === "working" || isApproval ? 1 : 0.2 }}
            />
            <div
              className="light"
              style={{ backgroundColor: "#4ade80", opacity: state === "idle" ? 1 : 0.2 }}
            />
          </div>
        )}
      </div>
      {hasQuota && (
        <div className="quota-area">
          {snapshot.quotaSlots.map((slot) => (
            <QuotaSlot key={slot.accountId} tiers={slot.tiers} size={28} />
          ))}
        </div>
      )}
    </div>
  );
}
