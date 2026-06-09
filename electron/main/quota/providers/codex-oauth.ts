import type { QuotaTier } from "../../../../shared/types";

// Codex / ChatGPT OAuth quota
// Uses ChatGPT backend-api wham usage endpoint

export async function queryCodexOauth(accessToken: string, _baseUrl?: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": "codex-cli",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`Auth error: ${resp.status}`);
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  const rateLimit = data?.rate_limit ?? data;
  const windows = [rateLimit?.primary_window, rateLimit?.secondary_window].filter(Boolean);

  for (const w of windows) {
    const secs = w.limit_window_seconds ?? w.window_seconds;
    const name = secs === 18000 ? "five_hour"
      : secs === 604800 ? "seven_day"
      : secs <= 86400 ? `window_${Math.round(secs / 3600)}h`
      : `window_${Math.round(secs / 86400)}d`;

    tiers.push({
      name,
      utilization: Math.round(w.used_percent ?? w.utilization ?? 0),
      resetsAt: w.reset_at ? new Date(w.reset_at * 1000).toISOString() : null,
    });
  }

  return tiers;
}
