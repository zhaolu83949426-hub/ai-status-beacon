import type { QuotaTier } from "../../../../shared/types";

export async function queryDeepSeekBalance(apiKey: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://api.deepseek.com/user/balance", {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`Auth error: ${resp.status}`);
  }
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${body}`);
  }

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  const isAvailable = data.is_available ?? true;
  const balanceInfos = data.balance_infos ?? [];

  for (const info of balanceInfos) {
    const currency = info.currency ?? "CNY";
    const totalBalance = parseNumber(info.total_balance);
    const grantedBalance = parseNumber(info.granted_balance);
    const toppedUpBalance = parseNumber(info.topped_up_balance);

    if (totalBalance !== null) {
      tiers.push({
        name: currency,
        utilization: isAvailable ? 0 : 100,
        resetsAt: null,
        usedValueUsd: totalBalance * 0.14,
        maxValueUsd: totalBalance * 0.14,
        planLabel: isAvailable ? `${currency} (可用)` : `${currency} (余额不足)`,
      });
    }
  }

  if (tiers.length === 0) {
    tiers.push({
      name: "CNY",
      utilization: isAvailable ? 0 : 100,
      resetsAt: null,
      usedValueUsd: 0,
      maxValueUsd: 0,
      planLabel: isAvailable ? "可用" : "余额不足",
    });
  }

  return tiers;
}

function parseNumber(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}