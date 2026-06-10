import type { QuotaAccount, AccountQuotaSnapshot, QuotaTier, QuotaAccountType } from "../../../shared/types";
import { CredentialStore } from "../security/credential-store";
import { queryClaudeOfficial } from "./providers/claude-official";
import { queryCodexOauth } from "./providers/codex-oauth";
import { queryGeminiOfficial } from "./providers/gemini-official";
import { queryCopilotPremium } from "./providers/copilot-premium";
import { queryKimiTokenPlan } from "./providers/kimi-token-plan";
import { queryZhipuTokenPlan } from "./providers/zhipu-token-plan";
import { queryMiniMaxTokenPlan } from "./providers/minimax-token-plan";
import { queryDeepSeekBalance } from "./providers/deepseek-balance";
import { queryStepFunBalance } from "./providers/stepfun-balance";
import { querySiliconFlowBalance } from "./providers/siliconflow-balance";
import { queryOpenRouterBalance } from "./providers/openrouter-balance";
import { queryNovitaBalance } from "./providers/novita-balance";
import { sortAndLimitTiers } from "./quota-normalizer";
import { getQuotaAccountTypeProfile } from "../../../shared/quota-account";

type ProviderFn = (credential: string, baseUrl?: string, accountId?: string) => Promise<QuotaTier[]>;

const PROVIDERS: Record<QuotaAccountType, ProviderFn> = {
  claude_official: queryClaudeOfficial,
  codex_oauth: queryCodexOauth,
  gemini_official: queryGeminiOfficial,
  github_copilot: queryCopilotPremium,
  kimi_token_plan: queryKimiTokenPlan,
  zhipu_token_plan: queryZhipuTokenPlan,
  minimax_token_plan: queryMiniMaxTokenPlan,
  deepseek_balance: queryDeepSeekBalance,
  stepfun_balance: queryStepFunBalance,
  siliconflow_balance: querySiliconFlowBalance,
  openrouter_balance: queryOpenRouterBalance,
  novita_balance: queryNovitaBalance,
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

    const profile = getQuotaAccountTypeProfile(account.type);
    const credential = profile.requiresSecret
      ? this.credentialStore.get(account.id, "api_key") ?? this.credentialStore.get(account.id, "access_token") ?? null
      : null;
    const accountId = this.credentialStore.getAccountId(account.id);

    if (profile.requiresSecret && !credential) {
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
      const tiers = await provider(credential ?? "", account.baseUrl ?? undefined, accountId ?? undefined);
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
    const slotIds = [slot1Id, slot2Id].filter((id): id is string => id !== null);
    const uniqueIds = [...new Set(slotIds)];
    const snapshotsByAccountId = new Map<string, AccountQuotaSnapshot>();

    const results = await Promise.allSettled(
      uniqueIds.map(async (accountId) => {
        const account = accounts.find((item) => item.id === accountId);
        return [accountId, account ? await this.queryAccount(account) : this.buildMissingSnapshot(accountId)] as const;
      }),
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const [accountId, snapshot] = result.value;
        snapshotsByAccountId.set(accountId, snapshot);
        return;
      }

      const failedAccountId = uniqueIds[index] ?? "";
      snapshotsByAccountId.set(failedAccountId, this.buildErrorSnapshot(failedAccountId, result.reason?.message));
    });

    return slotIds
      .map((accountId) => snapshotsByAccountId.get(accountId))
      .filter((snapshot): snapshot is AccountQuotaSnapshot => Boolean(snapshot));
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

  private buildMissingSnapshot(accountId: string): AccountQuotaSnapshot {
    return {
      accountId,
      accountType: "claude_official",
      success: false,
      credentialStatus: "not_found",
      tiers: [],
      error: "Account not found",
      queriedAt: null,
    };
  }

  private buildErrorSnapshot(accountId: string, message?: string): AccountQuotaSnapshot {
    return {
      accountId,
      accountType: "claude_official",
      success: false,
      credentialStatus: "parse_error",
      tiers: [],
      error: message ?? "Unknown error",
      queriedAt: null,
    };
  }
}
