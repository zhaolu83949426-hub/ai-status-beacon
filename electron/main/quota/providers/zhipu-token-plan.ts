import type { QuotaTier } from "../../../../shared/types";

// Zhipu GLM Token Plan quota
// API key-based, calls Zhipu quota limit endpoint

export async function queryZhipuTokenPlan(apiKey: string, baseUrl?: string): Promise<QuotaTier[]> {
  const url = (baseUrl ?? "https://open.bigmodel.cn/api") + "/monitor/usage/quota/limit";

  const resp = await fetch(url, {
    headers: {
      "Authorization": apiKey, // No "Bearer" prefix for Zhipu
      "Accept-Language": "en-US,en",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) throw new Error(`Auth error: ${resp.status}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  const limits = data?.data?.limits ?? [];
  // Sort by nextResetTime (nulls first), then map
  const sorted = [...limits]
    .filter((l: any) => (l.type ?? "").toUpperCase() === "TOKENS_LIMIT")
    .sort((a: any, b: any) => (a.nextResetTime ?? 0) - (b.nextResetTime ?? 0));

  sorted.forEach((l: any, i: number) => {
    const name = i === 0 ? "five_hour" : "weekly_limit";
    const resetsAt = l.nextResetTime ? new Date(l.nextResetTime).toISOString() : null;
    tiers.push({
      name,
      utilization: Math.round(l.percentage ?? 0),
      resetsAt,
      planLabel: data?.data?.level ?? null,
    });
  });

  return tiers;
}
