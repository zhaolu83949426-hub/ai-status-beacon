import { describe, expect, it } from "vitest";
import { QuotaService } from "../electron/main/quota/quota-service";
import type { QuotaAccount } from "../shared/types";

describe("Quota Service Slot Refresh", () => {
  it("preserves duplicate display slots for the same account", async () => {
    const service = new QuotaService();
    const account: QuotaAccount = {
      id: "account-1",
      type: "zhipu_token_plan",
      displayName: "智谱主账号",
      baseUrl: "https://open.bigmodel.cn/api/anthropic",
      createdAt: 1,
      updatedAt: 1,
    };

    (service as any).queryAccount = async (input: QuotaAccount) => ({
      accountId: input.id,
      accountType: input.type,
      success: true,
      credentialStatus: "valid",
      tiers: [{ name: "five_hour", utilization: 12, resetsAt: null }],
      error: null,
      queriedAt: 123,
    });

    const snapshots = await service.refreshSlots([account], account.id, account.id);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].accountId).toBe(account.id);
    expect(snapshots[1].accountId).toBe(account.id);
  });
});
