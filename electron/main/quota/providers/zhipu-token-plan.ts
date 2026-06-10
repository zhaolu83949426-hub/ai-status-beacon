import type { QuotaTier } from "../../../../shared/types";

// Zhipu GLM Token Plan quota
// API key-based, calls Zhipu quota limit endpoint

export async function queryZhipuTokenPlan(apiKey: string, baseUrl?: string): Promise<QuotaTier[]> {
  const url = `${resolveZhipuQuotaBase(baseUrl)}/api/monitor/usage/quota/limit`;

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
  if (data?.success === false) {
    throw new Error(data?.msg ?? "Quota query failed");
  }

  const tiers: QuotaTier[] = [];

  const limits = data?.data?.limits ?? [];
  // unit=3 为小时窗口（five_hour），unit=6 为周窗口（weekly_limit）
  for (const l of limits) {
    if ((l.type ?? "").toUpperCase() !== "TOKENS_LIMIT") continue;
    const name = l.unit === 3 ? "five_hour" : l.unit === 6 ? "weekly_limit" : null;
    if (!name) continue;
    tiers.push({
      name,
      utilization: Math.round(l.percentage ?? 0),
      resetsAt: l.nextResetTime ? new Date(l.nextResetTime).toISOString() : null,
      planLabel: data?.data?.level ?? null,
    });
  }

  return tiers;
}

export function resolveZhipuQuotaBase(baseUrl?: string): string {
  const normalized = (baseUrl ?? "").toLowerCase();
  if (normalized.includes("bigmodel.cn")) {
    return "https://open.bigmodel.cn";
  }
  return "https://api.z.ai";
}
