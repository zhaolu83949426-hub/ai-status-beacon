import type { QuotaAccountType, QuotaTier } from "../../shared/types";

const ACCOUNT_TYPE_LABELS: Record<QuotaAccountType, string> = {
  claude_official: "Claude",
  codex_oauth: "GPT",
  gemini_official: "Gemini",
  github_copilot: "Copilot",
  kimi_token_plan: "Kimi",
  zhipu_token_plan: "GLM",
  minimax_token_plan: "MiniMax",
  deepseek_balance: "DeepSeek",
  stepfun_balance: "StepFun",
  siliconflow_balance: "SiliconFlow",
  openrouter_balance: "OpenRouter",
  novita_balance: "Novita",
};

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
  const strokeWidth = 4.5;
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
  accountType,
  tiers,
  size = 32,
}: {
  accountType: QuotaAccountType;
  tiers: QuotaTier[];
  size?: number;
}) {
  const label = ACCOUNT_TYPE_LABELS[accountType];
  const isBalanceType = accountType.endsWith("_balance");

  if (tiers.length === 0) {
    return (
      <div className="quota-slot quota-slot-error" style={{ width: size, height: size }}>
        <span style={{ fontSize: size * 0.5 }}>?</span>
      </div>
    );
  }

  if (isBalanceType) {
    const tier = tiers[0];
    const balanceText = formatBalance(tier);
    return (
      <div className="quota-slot">
        <span className="quota-slot-label">{label}</span>
        <span className="quota-slot-balance" style={{ fontSize: size * 0.32 }}>
          {balanceText}
        </span>
      </div>
    );
  }

  return (
    <div className="quota-slot">
      <span className="quota-slot-label">{label}</span>
      <div className="quota-slot-circles">
        {tiers.map((t) => (
          <QuotaCircle key={t.name} tier={t} size={size} />
        ))}
      </div>
    </div>
  );
}

function formatBalance(tier: QuotaTier): string {
  if (tier.planLabel) {
    return tier.planLabel;
  }
  if (tier.usedValueUsd !== null && tier.maxValueUsd !== null) {
    const remaining = tier.maxValueUsd - tier.usedValueUsd;
    return `$${remaining.toFixed(2)}`;
  }
  return "$0.00";
}
