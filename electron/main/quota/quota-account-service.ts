import {
  getQuotaAccountCredentialKind,
  getQuotaAccountTypeProfile,
  normalizeQuotaAccountFormData,
  validateQuotaAccountFormData,
} from "../../../shared/quota-account";
import type { AppSettings, QuotaAccount, QuotaAccountFormData } from "../../../shared/types";
import { CredentialStore } from "../security/credential-store";
import type { SettingsStore } from "../settings/settings-store";

// 负责账号元数据和安全凭据的统一写入，避免设置页自己拼接存储细节。
export class QuotaAccountService {
  private credentialStore = new CredentialStore();

  constructor(private settingsStore: SettingsStore) {}

  saveAccount(input: QuotaAccountFormData): AppSettings {
    const normalized = normalizeQuotaAccountFormData(input);
    this.assertValid(normalized);

    const current = this.settingsStore.get();
    const existing = current.quota.accounts.find((account) => account.id === normalized.id);
    const account = this.buildAccount(normalized, existing);
    const accounts = existing
      ? current.quota.accounts.map((item) => (item.id === account.id ? account : item))
      : [...current.quota.accounts, account];
    const saved = this.settingsStore.save({
      ...current,
      quota: { ...current.quota, accounts },
    });

    this.syncCredential(account.type, account.id, normalized.secret, Boolean(existing), account.baseUrl);
    return saved;
  }

  deleteAccount(accountId: string): AppSettings {
    const current = this.settingsStore.get();
    const saved = this.settingsStore.save({
      ...current,
      quota: {
        ...current.quota,
        accounts: current.quota.accounts.filter((account) => account.id !== accountId),
        displaySlots: {
          slot1AccountId: current.quota.displaySlots.slot1AccountId === accountId ? null : current.quota.displaySlots.slot1AccountId,
          slot2AccountId: current.quota.displaySlots.slot2AccountId === accountId ? null : current.quota.displaySlots.slot2AccountId,
        },
      },
    });

    this.credentialStore.delete(accountId);
    return saved;
  }

  private assertValid(input: QuotaAccountFormData): void {
    const errors = validateQuotaAccountFormData(input);
    const message = errors.displayName ?? errors.baseUrl ?? errors.secret;
    if (message) {
      throw new Error(message);
    }
  }

  private buildAccount(
    input: QuotaAccountFormData,
    existing: QuotaAccount | undefined,
  ): QuotaAccount {
    return {
      id: input.id,
      type: input.type,
      displayName: input.displayName,
      baseUrl: input.baseUrl || null,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
  }

  private syncCredential(
    type: QuotaAccount["type"],
    accountId: string,
    secret: string,
    keepExisting: boolean,
    baseUrl?: string,
  ): void {
    const kind = getQuotaAccountCredentialKind(type);
    const requiresAccountId = this.requiresAccountId(type);

    if (kind && keepExisting && !secret) {
      return;
    }
    this.credentialStore.delete(accountId);
    if (kind && secret) {
      this.credentialStore.save(accountId, kind, secret);
    }
    if (requiresAccountId && baseUrl) {
      this.credentialStore.saveAccountId(accountId);
    }
  }

  private requiresAccountId(type: QuotaAccount["type"]): boolean {
    const profile = getQuotaAccountTypeProfile(type);
    return profile.requiresAccountId ?? false;
  }

  private findAccount(accountId: string): QuotaAccount | undefined {
    return this.settingsStore.get().quota.accounts.find((account) => account.id === accountId);
  }
}
