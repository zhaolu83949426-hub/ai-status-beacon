import { describe, expect, it } from "vitest";
import { resolveZhipuQuotaBase } from "../electron/main/quota/providers/zhipu-token-plan";

describe("Zhipu Token Plan Routing", () => {
  it("routes mainland endpoint to bigmodel quota host", () => {
    expect(resolveZhipuQuotaBase("https://open.bigmodel.cn/api/anthropic")).toBe("https://open.bigmodel.cn");
  });

  it("routes international endpoint to z.ai quota host", () => {
    expect(resolveZhipuQuotaBase("https://api.z.ai/api/paas/v4")).toBe("https://api.z.ai");
  });

  it("handles uppercase host names", () => {
    expect(resolveZhipuQuotaBase("HTTPS://OPEN.BIGMODEL.CN/api/anthropic")).toBe("https://open.bigmodel.cn");
  });
});
