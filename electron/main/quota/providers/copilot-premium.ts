import type { QuotaTier } from "../../../../shared/types";

// GitHub Copilot Premium quota
// Uses GitHub API copilot_internal/user endpoint

export async function queryCopilotPremium(githubToken: string): Promise<QuotaTier[]> {
  const resp = await fetch("https://api.github.com/copilot_internal/user", {
    headers: {
      "Authorization": `token ${githubToken}`,
      "Accept": "application/json",
      "Editor-Version": "vscode/1.110.1",
      "Editor-Plugin-Version": "copilot-chat/0.38.2",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`Auth error: ${resp.status}`);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json() as any;
  const tiers: QuotaTier[] = [];

  const snapshots = data?.quota_snapshots ?? {};
  for (const [key, snap] of Object.entries(snapshots)) {
    const s = snap as any;
    if (s.unlimited) continue;

    const total = s.entitlement ?? 100;
    const remaining = s.remaining ?? 0;
    const utilization = Math.round(((total - remaining) / total) * 100);

    tiers.push({
      name: `copilot_${key}`,
      utilization,
      resetsAt: data.quota_reset_date ? `${data.quota_reset_date}T00:00:00Z` : null,
      planLabel: data.copilot_plan ?? null,
    });
  }

  return tiers;
}
