import { describe, expect, it } from "vitest";
import {
  createQuotaAccountFormData,
  getQuotaAccountCredentialKind,
  getQuotaAccountTypeProfile,
  normalizeQuotaAccountFormData,
  validateQuotaAccountFormData,
} from "../shared/quota-account";

describe("Quota Account Profiles", () => {
  it("requires baseUrl and apiKey for token plan accounts", () => {
    const draft = createQuotaAccountFormData("kimi_token_plan");
    const errors = validateQuotaAccountFormData({
      ...draft,
      displayName: "Kimi",
      baseUrl: "",
      secret: "",
    });

    expect(errors.baseUrl).toBeTruthy();
    expect(errors.secret).toBeTruthy();
    expect(getQuotaAccountCredentialKind("kimi_token_plan")).toBe("api_key");
  });

  it("uses local oauth for official subscription accounts", () => {
    const profile = getQuotaAccountTypeProfile("codex_oauth");
    const errors = validateQuotaAccountFormData({
      ...createQuotaAccountFormData("codex_oauth"),
      displayName: "Codex 主账号",
    });

    expect(profile.usesLocalOauth).toBe(true);
    expect(errors.baseUrl).toBeUndefined();
    expect(errors.secret).toBeUndefined();
    expect(getQuotaAccountCredentialKind("codex_oauth")).toBeNull();
  });

  it("trims display name, secret and baseUrl trailing slash", () => {
    const normalized = normalizeQuotaAccountFormData({
      id: "account-1",
      type: "minimax_token_plan",
      displayName: "  MiniMax  ",
      baseUrl: "https://api.minimaxi.com/v1///",
      secret: "  token  ",
    });

    expect(normalized.displayName).toBe("MiniMax");
    expect(normalized.baseUrl).toBe("https://api.minimaxi.com/v1");
    expect(normalized.secret).toBe("token");
  });
});
