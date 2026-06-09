import type { QuotaTier } from "../../../../shared/types";

// Kimi Token Plan quota
// API key-based, calls Kimi coding usage endpoint

export async function queryKimiTokenPlan(apiKey: string, baseUrl?: string): Promise<QuotaTier[]> {
  const url = (baseUrl ?? "https://api.kimi.com/coding") + "/v1/usages";

  const resp = await fetch(url, {
    headers: { "Authorization": `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) throw new Error(`Auth error: ${resp.status}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  // Session/short-term limits
  const limits = data?.limits ?? [];
  if (limits.length > 0) {
    const first = limits[0]?.detail ?? limits[0];
    const limit = first.limit ?? 100;
    const remaining = first.remaining ?? limit;
    tiers.push({
      name: "five_hour",
      utilization: Math.round(((limit - remaining) / limit) * 100),
      resetsAt: first.resetTime ?? null,
    });
  }

  // Weekly limit
  const usage = data?.usage;
  if (usage) {
    const limit = usage.limit ?? 1000;
    const remaining = usage.remaining ?? limit;
    tiers.push({
      name: "weekly_limit",
      utilization: Math.round(((limit - remaining) / limit) * 100),
      resetsAt: usage.resetTime ?? null,
    });
  }

  return tiers;
}
