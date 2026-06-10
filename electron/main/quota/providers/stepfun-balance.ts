import type { QuotaTier } from "../../../../shared/types";

export async function queryStepFunBalance(apiKey: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://api.stepfun.com/v1/accounts", {
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

  const balance = parseNumber(data.balance);
  const totalCashBalance = parseNumber(data.total_cash_balance);
  const totalVoucherBalance = parseNumber(data.total_voucher_balance);

  if (balance !== null) {
    tiers.push({
      name: "StepFun",
      utilization: balance > 0 ? 0 : 100,
      resetsAt: null,
      usedValueUsd: 0,
      maxValueUsd: balance * 0.14,
      planLabel: `CNY ${balance.toFixed(2)}`,
    });
  }

  if (tiers.length === 0) {
    tiers.push({
      name: "StepFun",
      utilization: 100,
      resetsAt: null,
      usedValueUsd: 0,
      maxValueUsd: 0,
      planLabel: "CNY 0.00 (余额不足)",
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