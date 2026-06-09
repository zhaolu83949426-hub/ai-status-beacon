import type { QuotaAccount, AccountQuotaSnapshot, QuotaTier, QuotaAccountType } from "../../../shared/types";
import { CredentialStore } from "../security/credential-store";
import { queryClaudeOfficial } from "./providers/claude-official";
import { queryCodexOauth } from "./providers/codex-oauth";
import { queryGeminiOfficial } from "./providers/gemini-official";
import { queryCopilotPremium } from "./providers/copilot-premium";
import { queryKimiTokenPlan } from "./providers/kimi-token-plan";
import { queryZhipuTokenPlan } from "./providers/zhipu-token-plan";
import { queryMiniMaxTokenPlan } from "./providers/minimax-token-plan";
import { sortAndLimitTiers } from "./quota-normalizer";

type ProviderFn = (credential: string, baseUrl?: string) => Promise<QuotaTier[]>;

const PROVIDERS: Record<QuotaAccountType, ProviderFn> = {
  claude_official: queryClaudeOfficial,
  codex_oauth: queryCodexOauth,
  gemini_official: queryGeminiOfficial,
  github_copilot: queryCopilotPremium,
  kimi_token_plan: queryKimiTokenPlan,
  zhipu_token_plan: queryZhipuTokenPlan,
  minimax_token_plan: queryMiniMaxTokenPlan,
};

export class QuotaService {
  private credentialStore: CredentialStore;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.credentialStore = new CredentialStore();
  }

  async queryAccount(account: QuotaAccount): Promise<AccountQuotaSnapshot> {
    const provider = PROVIDERS[account.type];
    if (!provider) {
      return {
        accountId: account.id,
        accountType: account.type,
        success: false,
        credentialStatus: "not_found",
        tiers: [],
        error: `Unsupported account type: ${account.type}`,
        queriedAt: null,
      };
    }

    const credential = this.credentialStore.get(account.id, "api_key")
      ?? this.credentialStore.get(account.id, "access_token")
      ?? null;

    if (!credential) {
      return {
        accountId: account.id,
        accountType: account.type,
        success: false,
        credentialStatus: "not_found",
        tiers: [],
        error: "No credential found",
        queriedAt: null,
      };
    }

    try {
      const tiers = await provider(credential, account.baseUrl);
      return {
        accountId: account.id,
        accountType: account.type,
        success: true,
        credentialStatus: "valid",
        tiers: sortAndLimitTiers(tiers),
        error: null,
        queriedAt: Date.now(),
      };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const isAuthError = msg.includes("401") || msg.includes("403") || msg.includes("expired");
      return {
        accountId: account.id,
        accountType: account.type,
        success: false,
        credentialStatus: isAuthError ? "expired" : "valid",
        tiers: [],
        error: msg,
        queriedAt: Date.now(),
      };
    }
  }

  async refreshSlots(
    accounts: QuotaAccount[],
    slot1Id: string | null,
    slot2Id: string | null,
  ): Promise<AccountQuotaSnapshot[]> {
    const ids = [slot1Id, slot2Id].filter((id): id is string => id !== null);
    const toQuery = accounts.filter((a) => ids.includes(a.id));

    const results = await Promise.allSettled(
      toQuery.map((a) => this.queryAccount(a)),
    );

    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            accountId: "",
            accountType: "claude_official" as QuotaAccountType,
            success: false,
            credentialStatus: "parse_error" as const,
            tiers: [],
            error: r.reason?.message ?? "Unknown error",
            queriedAt: null,
          },
    );
  }

  startPeriodicRefresh(
    intervalMinutes: number,
    getAccounts: () => QuotaAccount[],
    getSlots: () => { slot1AccountId: string | null; slot2AccountId: string | null },
    onRefresh: (snapshots: AccountQuotaSnapshot[]) => void,
  ): void {
    this.stopPeriodicRefresh();
    const ms = intervalMinutes * 60_000;
    const tick = async () => {
      const accounts = getAccounts();
      const slots = getSlots();
      const snapshots = await this.refreshSlots(accounts, slots.slot1AccountId, slots.slot2AccountId);
      onRefresh(snapshots);
    };
    // Initial query
    tick();
    this.refreshTimer = setInterval(tick, ms);
  }

  stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
