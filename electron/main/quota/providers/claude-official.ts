import type { QuotaTier } from "../../../../shared/types";

// Claude Official subscription quota
// Reads OAuth access token from credentials, queries Anthropic usage API

export async function queryClaudeOfficial(accessToken: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
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

  // Parse usage windows
  const windows = data?.windows ?? data?.usage ?? [];
  for (const w of windows) {
    if (w.window_name || w.type || w.seconds) {
      const name = normalizeWindowName(w.window_name ?? w.type, w.seconds);
      tiers.push({
        name,
        utilization: Math.round(w.utilization ?? w.used_percent ?? w.usage_percentage ?? 0),
        resetsAt: w.resets_at ?? w.reset_at ?? null,
      });
    }
  }

  // Some responses have direct five_hour/seven_day fields
  if (data?.five_hour) {
    tiers.push({
      name: "five_hour",
      utilization: Math.round(data.five_hour.utilization ?? data.five_hour.used_percent ?? 0),
      resetsAt: data.five_hour.resets_at ?? null,
    });
  }
  if (data?.seven_day) {
    tiers.push({
      name: "seven_day",
      utilization: Math.round(data.seven_day.utilization ?? data.seven_day.used_percent ?? 0),
      resetsAt: data.seven_day.resets_at ?? null,
    });
  }

  return tiers;
}

function normalizeWindowName(name?: string, seconds?: number): string {
  if (name) {
    const lower = name.toLowerCase();
    if (lower.includes("5h") || lower.includes("five")) return "five_hour";
    if (lower.includes("7d") || lower.includes("seven") || lower.includes("week")) return "seven_day";
    return name;
  }
  if (seconds) {
    if (seconds === 18000) return "five_hour";
    if (seconds === 604800) return "seven_day";
    if (seconds <= 86400) return `window_${Math.round(seconds / 3600)}h`;
    return `window_${Math.round(seconds / 86400)}d`;
  }
  return "unknown";
}
