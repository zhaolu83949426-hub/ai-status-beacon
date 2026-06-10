import type { QuotaTier } from "../../../../shared/types";

export async function querySiliconFlowBalance(apiKey: string, baseUrl?: string): Promise<QuotaTier[]> {
  let domain = "api.siliconflow.cn";
  let currency = "CNY";

  if (baseUrl) {
    if (baseUrl.includes("api.siliconflow.com")) {
      domain = "api.siliconflow.com";
      currency = "USD";
    }
  }

  const resp = await fetch(`https://${domain}/v1/user/info`, {
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

  if (!data.data) {
    throw new Error("Missing data field in response");
  }

  const totalBalance = parseNumber(data.data.totalBalance);

  if (totalBalance !== null) {
    return [{
      name: "SiliconFlow",
      utilization: totalBalance > 0 ? 0 : 100,
      resetsAt: null,
      usedValueUsd: 0,
      maxValueUsd: currency === "CNY" ? totalBalance * 0.14 : totalBalance,
      planLabel: `${currency} ${totalBalance.toFixed(2)}`,
    }];
  }

  return [{
    name: "SiliconFlow",
    utilization: 100,
    resetsAt: null,
    usedValueUsd: 0,
    maxValueUsd: 0,
    planLabel: `${currency} 0.00 (余额不足)`,
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