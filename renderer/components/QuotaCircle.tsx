import type { QuotaTier } from "../../shared/types";

function getColor(utilization: number): string {
  if (utilization < 70) return "#4ade80";
  if (utilization < 90) return "#facc15";
  return "#f87171";
}

export function QuotaCircle({
  tier,
  size = 32,
}: {
  tier: QuotaTier;
  size?: number;
}) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (tier.utilization / 100) * circumference;
  const color = getColor(tier.utilization);
  const center = size / 2;

  return (
    <div className="quota-circle" title={`${tier.name}: ${tier.utilization}%`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
        />
      </svg>
      <span className="quota-circle-text" style={{ fontSize: size * 0.28 }}>
        {Math.round(tier.utilization)}
      </span>
    </div>
  );
}

export function QuotaSlot({
  tiers,
  size = 32,
}: {
  tiers: QuotaTier[];
  size?: number;
}) {
  if (tiers.length === 0) {
    return (
      <div className="quota-slot quota-slot-error" style={{ width: size, height: size }}>
        <span style={{ fontSize: size * 0.5 }}>?</span>
      </div>
    );
  }

  return (
    <div className="quota-slot">
      {tiers.map((t) => (
        <QuotaCircle key={t.name} tier={t} size={size} />
      ))}
    </div>
  );
}
