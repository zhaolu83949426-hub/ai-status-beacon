import type { QuotaTier } from "../../../../shared/types";

export async function queryNovitaBalance(apiKey: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://api.novita.ai/v3/user/balance", {
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

  const availableBalance = parseNumber(data.availableBalance);

  if (availableBalance !== null) {
    const balanceUsd = availableBalance / 10000;

    return [{
      name: "Novita AI",
      utilization: balanceUsd > 0 ? 0 : 100,
      resetsAt: null,
      usedValueUsd: 0,
      maxValueUsd: balanceUsd,
      planLabel: `USD ${balanceUsd.toFixed(2)}`,
    }];
  }

  return [{
    name: "Novita AI",
    utilization: 100,
    resetsAt: null,
    usedValueUsd: 0,
    maxValueUsd: 0,
    planLabel: "USD 0.00 (余额不足)",
  }];
}

function parseNumber(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}