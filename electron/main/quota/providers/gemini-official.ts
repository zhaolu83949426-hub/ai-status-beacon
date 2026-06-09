import type { QuotaTier } from "../../../../shared/types";

// Gemini Official quota — 2-step: get project ID, then retrieve user quota

export async function queryGeminiOfficial(accessToken: string): Promise<QuotaTier[]> {
  // Step 1: Get project ID
  const loadResp = await fetch("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadata: { ideType: "GEMINI_CLI", pluginType: "GEMINI" },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!loadResp.ok) throw new Error(`HTTP ${loadResp.status}`);

  const loadData = await loadResp.json() as any;
  const projectId = loadData?.project ?? loadData?.projectId;

  // Step 2: Retrieve user quota
  const quotaResp = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project: projectId }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!quotaResp.ok) throw new Error(`HTTP ${quotaResp.status}`);

  const quotaData = await quotaResp.json() as any;
  const tiers: QuotaTier[] = [];

  const buckets = quotaData?.buckets ?? [];
  for (const bucket of buckets) {
    const modelId = bucket.modelId ?? bucket.model ?? "unknown";
    const remaining = bucket.remainingFraction ?? bucket.remaining_fraction ?? 1;
    const utilization = Math.round((1 - remaining) * 100);
    const name = classifyGeminiModel(modelId as string);

    tiers.push({
      name,
      utilization,
      resetsAt: bucket.resetTime ?? bucket.reset_time ?? null,
    });
  }

  return tiers;
}

function classifyGeminiModel(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("flash-lite")) return "gemini_flash_lite";
  if (lower.includes("flash")) return "gemini_flash";
  if (lower.includes("pro")) return "gemini_pro";
  return modelId.replace("models/", "");
}
