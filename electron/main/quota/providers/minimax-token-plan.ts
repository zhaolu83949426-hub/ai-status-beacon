import type { QuotaTier } from "../../../../shared/types";

// MiniMax Token Plan quota
// API key-based, calls MiniMax coding plan remains endpoint

export async function queryMiniMaxTokenPlan(apiKey: string, baseUrl?: string): Promise<QuotaTier[]> {
  const url = (baseUrl ?? "https://api.minimaxi.com/v1") + "/api/openplatform/coding_plan/remains";

  const resp = await fetch(url, {
    headers: { "Authorization": `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) throw new Error(`Auth error: ${resp.status}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  const models = data?.model_remains ?? [];
  for (const model of models) {
    if (model.model_name !== "general") continue;
    if (model.current_weekly_status !== 1) continue;

    // 5-hour window
    if (model.current_interval_remaining_percent !== undefined) {
      tiers.push({
        name: "five_hour",
        utilization: Math.round(100 - model.current_interval_remaining_percent),
        resetsAt: model.end_time ? new Date(model.end_time).toISOString() : null,
      });
    }

    // Weekly window
    if (model.current_weekly_remaining_percent !== undefined) {
      tiers.push({
        name: "weekly_limit",
        utilization: Math.round(100 - model.current_weekly_remaining_percent),
        resetsAt: model.weekly_end_time ? new Date(model.weekly_end_time).toISOString() : null,
      });
    }
  }

  return tiers;
}
