import { useEffect, useState } from "react";
import {
  QUOTA_ACCOUNT_LIMITS,
  QUOTA_ACCOUNT_TYPE_OPTIONS,
  createQuotaAccountFormData,
  createQuotaAccountFormDataFromAccount,
  getQuotaAccountLabel,
  getQuotaAccountTypeProfile,
  normalizeQuotaAccountFormData,
  validateQuotaAccountFormData,
} from "../../../../shared/quota-account";
import type {
  AccountQuotaSnapshot,
  AppSettings,
  QuotaAccount,
  QuotaAccountFormData,
  QuotaAccountValidationErrors,
  QuotaAccountType,
} from "../../../../shared/types";

type FormMode = "create" | "edit";

export function AccountsTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [createDraft, setCreateDraft] = useState<QuotaAccountFormData | null>(null);
  const [createErrors, setCreateErrors] = useState<QuotaAccountValidationErrors>({});
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<QuotaAccountFormData | null>(null);
  const [editErrors, setEditErrors] = useState<QuotaAccountValidationErrors>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState<FormMode | null>(null);
  const [loadingEditorId, setLoadingEditorId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [credentialReady, setCredentialReady] = useState<Record<string, boolean>>({});
  const [quotaResults, setQuotaResults] = useState<Record<string, AccountQuotaSnapshot>>({});
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  const accounts = settings.quota.accounts;
  const slots = settings.quota.displaySlots;
  const filteredTypes = QUOTA_ACCOUNT_TYPE_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    setCredentialReady((current) => {
      const next = { ...current };
      for (const account of accounts) {
        if (getQuotaAccountTypeProfile(account.type).usesLocalOauth) {
          next[account.id] = true;
        }
      }
      return next;
    });
  }, [accounts]);

  const closeCreate = () => {
    setShowAdd(false);
    setSearch("");
    setCreateDraft(null);
    setCreateErrors({});
    setCreateSubmitError(null);
  };

  const startCreate = (type: QuotaAccountType) => {
    setCreateDraft(createQuotaAccountFormData(type));
    setCreateErrors({});
    setCreateSubmitError(null);
  };

  const startEdit = async (account: QuotaAccount) => {
    setLoadingEditorId(account.id);
    setEditSubmitError(null);
    setEditErrors({});
    try {
      setEditingId(account.id);
      setEditingDraft(createQuotaAccountFormDataFromAccount(account));
    } catch (error) {
      const message = formatAccountActionError(error);
      setRuntimeWarning(message);
      setEditSubmitError(message);
    } finally {
      setLoadingEditorId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(null);
    setEditErrors({});
    setEditSubmitError(null);
  };

  const saveAccount = async (mode: FormMode) => {
    const draft = mode === "create" ? createDraft : editingDraft;
    if (!draft) return;

    const normalized = normalizeQuotaAccountFormData(draft);
    const errors = validateQuotaAccountFormData(normalized);
    if (mode === "edit" && credentialReady[normalized.id] && !normalized.secret) {
      delete errors.secret;
    }
    if (errors.displayName || errors.baseUrl || errors.secret) {
      if (mode === "create") {
        setCreateErrors(errors);
      } else {
        setEditErrors(errors);
      }
      return;
    }

    setSavingMode(mode);
    if (mode === "create") {
      setCreateSubmitError(null);
    } else {
      setEditSubmitError(null);
    }

    try {
      const updated = await window.beaconApi.saveQuotaAccount(normalized);
      onSave(updated);
      if (getQuotaAccountTypeProfile(normalized.type).requiresSecret) {
        setCredentialReady((current) => ({ ...current, [normalized.id]: Boolean(normalized.secret) }));
      }
      if (mode === "create") {
        closeCreate();
      } else {
        cancelEdit();
      }
    } catch (error) {
      const message = formatAccountActionError(error);
      setRuntimeWarning(message);
      if (mode === "create") {
        setCreateSubmitError(message);
      } else {
        setEditSubmitError(message);
      }
    } finally {
      setSavingMode(null);
    }
  };

  const removeAccount = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      const updated = await window.beaconApi.deleteQuotaAccount(accountId);
      onSave(updated);
      setCredentialReady((current) => {
        const next = { ...current };
        delete next[accountId];
        return next;
      });
      setQuotaResults((current) => {
        const next = { ...current };
        delete next[accountId];
        return next;
      });
      if (editingId === accountId) {
        cancelEdit();
      }
    } catch (error) {
      setRuntimeWarning(formatAccountActionError(error));
    } finally {
      setDeletingId(null);
    }
  };

  const assignSlot = async (accountId: string, slot: 1 | 2) => {
    const key = slot === 1 ? "slot1AccountId" : "slot2AccountId";
    const current = slots[key];
    const updated = await window.beaconApi.saveSettings({
      ...settings,
      quota: {
        ...settings.quota,
        displaySlots: { ...slots, [key]: current === accountId ? null : accountId },
      },
    });
    onSave(updated);
  };

  const checkQuota = async (accountId: string) => {
    setCheckingId(accountId);
    try {
      const snapshot = await window.beaconApi.refreshQuota(accountId);
      setQuotaResults((current) => ({ ...current, [accountId]: snapshot }));
    } catch (error) {
      setRuntimeWarning(formatAccountActionError(error));
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="section">
      {runtimeWarning && <div className="account-runtime-warning">{runtimeWarning}</div>}
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => (showAdd ? closeCreate() : setShowAdd(true))}>
          {showAdd ? "取消" : "+ 添加账号"}
        </button>
      </div>

      {showAdd && (
        <div className="add-panel">
          {!createDraft ? (
            <>
              <input
                className="text-input"
                placeholder="搜索账号类型..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="type-list">
                {filteredTypes.map((option) => (
                  <button key={option.value} className="type-item" onClick={() => startCreate(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <AccountForm
              draft={createDraft}
              errors={createErrors}
              submitError={createSubmitError}
              loading={savingMode === "create"}
              submitLabel="保存账号"
              onChange={setCreateDraft}
              onSubmit={() => saveAccount("create")}
              onCancel={closeCreate}
            />
          )}
        </div>
      )}

      <div className="account-list">
        {accounts.length === 0 && <div className="empty-state">暂无账号</div>}
        {accounts.map((account) => (
          <div key={account.id} className="account-card">
            {editingId === account.id && editingDraft ? (
              <AccountForm
                draft={editingDraft}
                errors={editErrors}
                submitError={editSubmitError}
                loading={savingMode === "edit"}
                submitLabel="保存修改"
                onChange={setEditingDraft}
                onSubmit={() => saveAccount("edit")}
                onCancel={cancelEdit}
              />
            ) : (
              <AccountCard
                account={account}
                slot1Active={slots.slot1AccountId === account.id}
                slot2Active={slots.slot2AccountId === account.id}
                credentialReady={credentialReady[account.id]}
                quotaResult={quotaResults[account.id]}
                editing={loadingEditorId === account.id}
                checking={checkingId === account.id}
                deleting={deletingId === account.id}
                onAssignSlot={assignSlot}
                onEdit={startEdit}
                onDelete={removeAccount}
                onCheckQuota={checkQuota}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountCard(props: {
  account: QuotaAccount;
  slot1Active: boolean;
  slot2Active: boolean;
  credentialReady?: boolean;
  quotaResult?: AccountQuotaSnapshot;
  editing: boolean;
  checking: boolean;
  deleting: boolean;
  onAssignSlot: (accountId: string, slot: 1 | 2) => void;
  onEdit: (account: QuotaAccount) => void;
  onDelete: (accountId: string) => void;
  onCheckQuota: (accountId: string) => void;
}) {
  const profile = getQuotaAccountTypeProfile(props.account.type);

  return (
    <>
      <div className="account-card-header">
        <span className="account-name">{props.account.displayName}</span>
        <span className="account-type-badge">{getQuotaAccountLabel(props.account.type)}</span>
      </div>
      <div className="account-meta-list">
        <div className="account-meta-row">
          <span className="account-meta-label">凭据</span>
          <span className="account-meta-value">
            {profile.usesLocalOauth
              ? "自动读取本机 OAuth 凭据"
              : props.credentialReady
                ? `已录入${profile.secretLabel}`
                : `未录入${profile.secretLabel}`}
          </span>
        </div>
        {profile.requiresBaseUrl && props.account.baseUrl && (
          <div className="account-meta-row">
            <span className="account-meta-label">Base URL</span>
            <span className="account-meta-value mono-text">{props.account.baseUrl}</span>
          </div>
        )}
        {props.quotaResult && (
          <div className="account-meta-row">
            <span className="account-meta-label">额度检查</span>
            <span className={`account-meta-value ${props.quotaResult.success ? "" : "account-meta-error"}`}>
              {formatQuotaResult(props.quotaResult)}
            </span>
          </div>
        )}
      </div>
      <div className="account-card-actions">
        <button className={`btn-sm ${props.slot1Active ? "active" : ""}`} onClick={() => props.onAssignSlot(props.account.id, 1)}>
          展示位 1
        </button>
        <button className={`btn-sm ${props.slot2Active ? "active" : ""}`} onClick={() => props.onAssignSlot(props.account.id, 2)}>
          展示位 2
        </button>
        <button className="btn-sm" onClick={() => props.onCheckQuota(props.account.id)} disabled={props.checking}>
          {props.checking ? "检查中..." : "检查额度"}
        </button>
        <button className="btn-sm" onClick={() => props.onEdit(props.account)} disabled={props.editing}>
          {props.editing ? "读取中..." : "编辑"}
        </button>
        <button className="btn-sm btn-danger" onClick={() => props.onDelete(props.account.id)} disabled={props.deleting}>
          {props.deleting ? "删除中..." : "删除"}
        </button>
      </div>
    </>
  );
}

function AccountForm(props: {
  draft: QuotaAccountFormData;
  errors: QuotaAccountValidationErrors;
  submitError: string | null;
  loading: boolean;
  submitLabel: string;
  onChange: (draft: QuotaAccountFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const profile = getQuotaAccountTypeProfile(props.draft.type);

  return (
    <div className="account-form">
      <div className="account-form-header">
        <span className="account-type-badge">{getQuotaAccountLabel(props.draft.type)}</span>
        {!profile.usesLocalOauth && <span className="field-label-secondary">凭据会保存在本机安全存储中</span>}
      </div>
      <TextField
        label="账号名称"
        required
        value={props.draft.displayName}
        maxLength={QUOTA_ACCOUNT_LIMITS.displayName}
        error={props.errors.displayName}
        onChange={(value) => props.onChange({ ...props.draft, displayName: value })}
      />
      {profile.requiresBaseUrl && (
        <TextField
          label={profile.baseUrlLabel || "Base URL"}
          required
          value={props.draft.baseUrl}
          placeholder={profile.baseUrlPlaceholder}
          maxLength={QUOTA_ACCOUNT_LIMITS.baseUrl}
          error={props.errors.baseUrl}
          onChange={(value) => props.onChange({ ...props.draft, baseUrl: value })}
        />
      )}
      {profile.requiresSecret && (
        <TextField
          label={profile.secretLabel}
          required
          type="password"
          value={props.draft.secret}
          placeholder={profile.secretPlaceholder || "留空表示保持当前密钥"}
          maxLength={QUOTA_ACCOUNT_LIMITS.secret}
          error={props.errors.secret}
          onChange={(value) => props.onChange({ ...props.draft, secret: value })}
        />
      )}
      {profile.usesLocalOauth && (
        <div className="account-form-hint">
          该账号类型会直接读取本机 CLI 已登录的 OAuth 凭据，无需手动填写密钥。
        </div>
      )}
      {props.submitError && <div className="field-error">{props.submitError}</div>}
      <div className="account-form-actions">
        <button className="btn btn-primary" onClick={props.onSubmit} disabled={props.loading}>
          {props.loading ? "保存中..." : props.submitLabel}
        </button>
        <button className="btn btn-soft" onClick={props.onCancel} disabled={props.loading}>
          取消
        </button>
      </div>
    </div>
  );
}

function TextField(props: {
  label: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  maxLength: number;
  type?: "text" | "password";
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="account-field">
      <label className="account-field-label">
        {props.required && <span className="required-mark">*</span>}
        {props.label}
      </label>
      <input
        className={`text-input ${props.error ? "input-error" : ""}`}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <div className="account-field-footer">
        <span className="field-error">{props.error ?? ""}</span>
        <span className="field-length">{props.value.length}/{props.maxLength}</span>
      </div>
    </div>
  );
}

function formatQuotaResult(snapshot: AccountQuotaSnapshot): string {
  if (!snapshot.success) {
    return snapshot.error ?? "查询失败";
  }
  if (snapshot.tiers.length === 0) {
    return "未返回额度窗口";
  }
  return snapshot.tiers
    .map((tier) => `${tier.name} ${Math.round(tier.utilization)}%`)
    .join(" / ");
}

function formatAccountActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("No handler registered for 'getQuotaAccountSecret'")) {
    return "当前应用主进程还是旧版本，请完全退出 AI Status Beacon 后重新启动，再编辑账号。";
  }
  if (message.includes("No handler registered for 'saveQuotaAccount'")) {
    return "当前应用主进程还是旧版本，请完全退出 AI Status Beacon 后重新启动，再保存账号。";
  }
  if (message.includes("No handler registered for 'deleteQuotaAccount'")) {
    return "当前应用主进程还是旧版本，请完全退出 AI Status Beacon 后重新启动，再删除账号。";
  }
  if (message.includes("No handler registered for 'refreshQuota'")) {
    return "当前应用主进程还是旧版本，请完全退出 AI Status Beacon 后重新启动，再检查额度。";
  }
  return message;
}
