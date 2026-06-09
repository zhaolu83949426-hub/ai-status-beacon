import { useState } from "react";
import type { AppSettings, QuotaAccount, QuotaAccountType } from "../../../../shared/types";

const ACCOUNT_TYPES: { value: QuotaAccountType; label: string; needsBaseUrl: boolean; needsApiKey: boolean; needsOAuth: boolean }[] = [
  { value: "claude_official", label: "Claude 官方订阅", needsBaseUrl: false, needsApiKey: false, needsOAuth: true },
  { value: "codex_oauth", label: "Codex / ChatGPT", needsBaseUrl: false, needsApiKey: false, needsOAuth: true },
  { value: "gemini_official", label: "Gemini 官方订阅", needsBaseUrl: false, needsApiKey: false, needsOAuth: true },
  { value: "github_copilot", label: "GitHub Copilot", needsBaseUrl: false, needsApiKey: false, needsOAuth: true },
  { value: "kimi_token_plan", label: "Kimi Token Plan", needsBaseUrl: false, needsApiKey: true, needsOAuth: false },
  { value: "zhipu_token_plan", label: "智谱 GLM Token Plan", needsBaseUrl: true, needsApiKey: true, needsOAuth: false },
  { value: "minimax_token_plan", label: "MiniMax Token Plan", needsBaseUrl: true, needsApiKey: true, needsOAuth: false },
];

export function AccountsTab({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const accounts = settings.quota.accounts;
  const slots = settings.quota.displaySlots;

  const filteredTypes = ACCOUNT_TYPES.filter((t) =>
    t.label.toLowerCase().includes(search.toLowerCase()),
  );

  const addAccount = (type: QuotaAccountType) => {
    const newAccount: QuotaAccount = {
      id: crypto.randomUUID(),
      type,
      displayName: ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type,
      credentialRef: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave({
      ...settings,
      quota: {
        ...settings.quota,
        accounts: [...accounts, newAccount],
      },
    });
    setShowAdd(false);
    setEditId(newAccount.id);
  };

  const removeAccount = (id: string) => {
    onSave({
      ...settings,
      quota: {
        ...settings.quota,
        accounts: accounts.filter((a) => a.id !== id),
        displaySlots: {
          slot1AccountId: slots.slot1AccountId === id ? null : slots.slot1AccountId,
          slot2AccountId: slots.slot2AccountId === id ? null : slots.slot2AccountId,
        },
      },
    });
    if (editId === id) setEditId(null);
  };

  const assignSlot = (accountId: string, slot: 1 | 2) => {
    const key = slot === 1 ? "slot1AccountId" : "slot2AccountId";
    const current = slots[key];
    onSave({
      ...settings,
      quota: {
        ...settings.quota,
        displaySlots: { ...slots, [key]: current === accountId ? null : accountId },
      },
    });
  };

  return (
    <div className="settings-section">
      <div className="settings-toolbar">
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "取消" : "+ 添加账号"}
        </button>
      </div>

      {showAdd && (
        <div className="account-add-panel">
          <input
            className="settings-input"
            placeholder="搜索账号类型..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="account-type-list">
            {filteredTypes.map((t) => (
              <button key={t.value} className="account-type-item" onClick={() => addAccount(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="account-list">
        {accounts.length === 0 && (
          <div className="settings-empty">暂无账号</div>
        )}
        {accounts.map((account) => (
          <div key={account.id} className="account-card">
            <div className="account-card-header">
              <span className="account-name">{account.displayName}</span>
              <span className="account-type-badge">
                {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? account.type}
              </span>
            </div>
            <div className="account-card-actions">
              <button
                className={`btn-sm ${slots.slot1AccountId === account.id ? "active" : ""}`}
                onClick={() => assignSlot(account.id, 1)}
              >
                展示位 1
              </button>
              <button
                className={`btn-sm ${slots.slot2AccountId === account.id ? "active" : ""}`}
                onClick={() => assignSlot(account.id, 2)}
              >
                展示位 2
              </button>
              <button className="btn-sm btn-danger" onClick={() => removeAccount(account.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
