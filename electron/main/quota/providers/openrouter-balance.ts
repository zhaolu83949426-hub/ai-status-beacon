import type { QuotaTier } from "../../../../shared/types";

export async function queryOpenRouterBalance(apiKey: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://openrouter.ai/api/v1/credits", {
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
  const apiData = data.data ?? data;

  const totalCredits = parseNumber(apiData.total_credits);
  const totalUsage = parseNumber(apiData.total_usage);

  if (totalCredits !== null) {
    const remaining = totalCredits - (totalUsage ?? 0);
    const utilization = totalCredits > 0 ? Math.round((totalUsage ?? 0) / totalCredits * 100) : 100;

    return [{
      name: "OpenRouter",
      utilization,
      resetsAt: null,
      usedValueUsd: totalUsage ?? 0,
      maxValueUsd: totalCredits,
      planLabel: `USD ${remaining.toFixed(2)}`,
    }];
  }

  return [{
    name: "OpenRouter",
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