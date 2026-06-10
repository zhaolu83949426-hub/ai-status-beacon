import type {
  QuotaAccount,
  QuotaAccountFormData,
  QuotaAccountType,
  QuotaAccountValidationErrors,
} from "./types";

export const QUOTA_ACCOUNT_LIMITS = {
  displayName: 40,
  baseUrl: 2048,
  secret: 4096,
} as const;

export type QuotaAccountCredentialKind = "api_key" | "access_token";

export interface QuotaAccountTypeOption {
  value: QuotaAccountType;
  label: string;
}

interface QuotaAccountTypeProfile {
  label: string;
  defaultBaseUrl: string;
  usesLocalOauth: boolean;
  requiresBaseUrl: boolean;
  requiresSecret: boolean;
  secretKind: QuotaAccountCredentialKind | null;
  secretLabel: string;
  secretPlaceholder: string;
  requiresAccountId: boolean;
}

const QUOTA_ACCOUNT_PROFILES: Record<QuotaAccountType, QuotaAccountTypeProfile> = {
  claude_official: {
    label: "Claude 官方订阅",
    defaultBaseUrl: "",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "access_token",
    secretLabel: "Access Token",
    secretPlaceholder: "请输入 Claude Access Token",
    requiresAccountId: false,
  },
  codex_oauth: {
    label: "Codex / ChatGPT (本地会话)",
    defaultBaseUrl: "",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: false,
    secretKind: null,
    secretLabel: "",
    secretPlaceholder: "",
    requiresAccountId: false,
  },
  gemini_official: {
    label: "Gemini 官方订阅",
    defaultBaseUrl: "",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "access_token",
    secretLabel: "Access Token",
    secretPlaceholder: "请输入 Gemini Access Token",
    requiresAccountId: false,
  },
  github_copilot: {
    label: "GitHub Copilot",
    defaultBaseUrl: "",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "access_token",
    secretLabel: "GitHub Token",
    secretPlaceholder: "ghu_ / github_pat_...",
    requiresAccountId: false,
  },
  kimi_token_plan: {
    label: "Kimi Token Plan",
    defaultBaseUrl: "https://api.kimi.com/coding",
    usesLocalOauth: false,
    requiresBaseUrl: true,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 Kimi API Key",
    requiresAccountId: false,
  },
  zhipu_token_plan: {
    label: "智谱 GLM Token Plan",
    defaultBaseUrl: "https://open.bigmodel.cn/api",
    usesLocalOauth: false,
    requiresBaseUrl: true,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入智谱 API Key",
    requiresAccountId: false,
  },
  minimax_token_plan: {
    label: "MiniMax Token Plan",
    defaultBaseUrl: "https://api.minimaxi.com/v1",
    usesLocalOauth: false,
    requiresBaseUrl: true,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 MiniMax API Key",
    requiresAccountId: false,
  },
  deepseek_balance: {
    label: "DeepSeek 余额",
    defaultBaseUrl: "https://api.deepseek.com",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 DeepSeek API Key",
    requiresAccountId: false,
  },
  stepfun_balance: {
    label: "StepFun 余额",
    defaultBaseUrl: "https://api.stepfun.com",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 StepFun API Key",
    requiresAccountId: false,
  },
  siliconflow_balance: {
    label: "SiliconFlow 余额",
    defaultBaseUrl: "https://api.siliconflow.cn",
    usesLocalOauth: false,
    requiresBaseUrl: true,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 SiliconFlow API Key",
    requiresAccountId: false,
  },
  openrouter_balance: {
    label: "OpenRouter 余额",
    defaultBaseUrl: "https://openrouter.ai",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 OpenRouter API Key",
    requiresAccountId: false,
  },
  novita_balance: {
    label: "Novita AI 余额",
    defaultBaseUrl: "https://api.novita.ai",
    usesLocalOauth: false,
    requiresBaseUrl: false,
    requiresSecret: true,
    secretKind: "api_key",
    secretLabel: "API Key",
    secretPlaceholder: "请输入 Novita AI API Key",
    requiresAccountId: false,
  },
};

export const QUOTA_ACCOUNT_TYPE_OPTIONS: QuotaAccountTypeOption[] = Object.entries(
  QUOTA_ACCOUNT_PROFILES,
).map(([value, profile]) => ({
  value: value as QuotaAccountType,
  label: profile.label,
}));

export function getQuotaAccountLabel(type: QuotaAccountType): string {
  return QUOTA_ACCOUNT_PROFILES[type].label;
}

export function getQuotaAccountTypeProfile(type: QuotaAccountType): {
  defaultBaseUrl: string;
  usesLocalOauth: boolean;
  requiresBaseUrl: boolean;
  requiresSecret: boolean;
  secretLabel: string;
  secretPlaceholder: string;
  requiresAccountId: boolean;
} {
  const profile = QUOTA_ACCOUNT_PROFILES[type];
  return {
    defaultBaseUrl: profile.defaultBaseUrl,
    usesLocalOauth: profile.usesLocalOauth,
    requiresBaseUrl: profile.requiresBaseUrl,
    requiresSecret: profile.requiresSecret,
    secretLabel: profile.secretLabel,
    secretPlaceholder: profile.secretPlaceholder,
    requiresAccountId: profile.requiresAccountId,
  };
}

export function getQuotaAccountCredentialKind(
  type: QuotaAccountType,
): QuotaAccountCredentialKind | null {
  return QUOTA_ACCOUNT_PROFILES[type].secretKind;
}

export function createQuotaAccountFormData(type: QuotaAccountType): QuotaAccountFormData {
  return {
    id: crypto.randomUUID(),
    type,
    displayName: getQuotaAccountLabel(type),
    baseUrl: QUOTA_ACCOUNT_PROFILES[type].defaultBaseUrl,
    secret: "",
  };
}

export function createQuotaAccountFormDataFromAccount(
  account: QuotaAccount,
): QuotaAccountFormData {
  return {
    id: account.id,
    type: account.type,
    displayName: account.displayName,
    baseUrl: account.baseUrl ?? QUOTA_ACCOUNT_PROFILES[account.type].defaultBaseUrl,
    secret: "",
  };
}

export function normalizeQuotaAccountFormData(
  input: QuotaAccountFormData,
): QuotaAccountFormData {
  return {
    ...input,
    displayName: input.displayName.trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    secret: input.secret.trim(),
  };
}

export function validateQuotaAccountFormData(
  input: QuotaAccountFormData,
): QuotaAccountValidationErrors {
  const profile = QUOTA_ACCOUNT_PROFILES[input.type];
  const errors: QuotaAccountValidationErrors = {};

  if (!input.displayName) {
    errors.displayName = "账号名称不能为空";
  } else if (input.displayName.length > QUOTA_ACCOUNT_LIMITS.displayName) {
    errors.displayName = `账号名称不能超过 ${QUOTA_ACCOUNT_LIMITS.displayName} 个字符`;
  }

  if (profile.requiresBaseUrl && !input.baseUrl) {
    errors.baseUrl = "Base URL 不能为空";
  } else if (input.baseUrl.length > QUOTA_ACCOUNT_LIMITS.baseUrl) {
    errors.baseUrl = `Base URL 不能超过 ${QUOTA_ACCOUNT_LIMITS.baseUrl} 个字符`;
  }

  if (profile.requiresSecret && !input.secret) {
    errors.secret = `${profile.secretLabel}不能为空`;
  } else if (input.secret.length > QUOTA_ACCOUNT_LIMITS.secret) {
    errors.secret = `${profile.secretLabel}不能超过 ${QUOTA_ACCOUNT_LIMITS.secret} 个字符`;
  }

  return errors;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
