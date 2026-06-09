// Validation constants from design doc §10.2

export const VALIDATION = {
  accountDisplayName: { required: true, maxLength: 40 },
  baseUrl: { required: false, maxLength: 2048 },       // required for token plan types
  apiKey: { required: false, maxLength: 4096 },         // required for token plan types
  oauthIdentifier: { required: false, maxLength: 128 }, // required for OAuth types
  soundPath: { required: false, maxLength: 260 },
} as const;

export type ValidationField = keyof typeof VALIDATION;

export function validateField(field: ValidationField, value: string | null | undefined, context?: { isTokenPlan?: boolean; isOAuth?: boolean }): string | null {
  const rule = VALIDATION[field];
  const str = value ?? "";

  if (rule.required || (field === "baseUrl" && context?.isTokenPlan) || (field === "apiKey" && context?.isTokenPlan) || (field === "oauthIdentifier" && context?.isOAuth)) {
    if (!str.trim()) return `${field} is required`;
  }

  if (str.length > rule.maxLength) {
    return `${field} must be at most ${rule.maxLength} characters`;
  }

  return null;
}
