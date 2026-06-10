import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

const FEATURES_HEADER = "[features]";
const HOOKS_KEY = "hooks";
const LEGACY_HOOKS_KEY = "codex_hooks";

export function isCodexHooksFeatureEnabled(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  return readCodexHooksFeature(readFileSync(filePath, "utf-8")) === "enabled";
}

export function ensureCodexHooksFeature(filePath: string): void {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  const next = buildCodexHooksFeatureText(current);
  if (next === current) return;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, next, "utf-8");
}

function buildCodexHooksFeatureText(text: string): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text ? text.split(/\r?\n/) : [];
  const range = findFeaturesRange(lines);

  if (!range) {
    return `${FEATURES_HEADER}${newline}${HOOKS_KEY} = true${newline}`;
  }

  const { start, end } = range;
  const hooksIndex = findFeatureKey(lines, start, end, HOOKS_KEY);
  if (hooksIndex >= 0) {
    if (readBooleanValue(lines[hooksIndex]) === false) return normalizeToml(lines, newline);
    lines[hooksIndex] = `${HOOKS_KEY} = true`;
    removeDuplicateFeatureKeys(lines, start, end, HOOKS_KEY, hooksIndex);
    removeDuplicateFeatureKeys(lines, start, end, LEGACY_HOOKS_KEY, -1);
    return normalizeToml(lines, newline);
  }

  const legacyIndex = findFeatureKey(lines, start, end, LEGACY_HOOKS_KEY);
  if (legacyIndex >= 0) {
    const legacyValue = readBooleanValue(lines[legacyIndex]);
    lines[legacyIndex] = `${HOOKS_KEY} = ${legacyValue === false ? "false" : "true"}`;
    removeDuplicateFeatureKeys(lines, start, end, LEGACY_HOOKS_KEY, legacyIndex);
    return normalizeToml(lines, newline);
  }

  lines.splice(start + 1, 0, `${HOOKS_KEY} = true`);
  return normalizeToml(lines, newline);
}

function readCodexHooksFeature(text: string): "enabled" | "disabled" | "missing" {
  const lines = text.split(/\r?\n/);
  const range = findFeaturesRange(lines);
  if (!range) return "missing";

  const hooksIndex = findFeatureKey(lines, range.start, range.end, HOOKS_KEY);
  if (hooksIndex >= 0) {
    return readBooleanValue(lines[hooksIndex]) === true ? "enabled" : "disabled";
  }

  const legacyIndex = findFeatureKey(lines, range.start, range.end, LEGACY_HOOKS_KEY);
  if (legacyIndex >= 0) {
    return readBooleanValue(lines[legacyIndex]) === true ? "enabled" : "disabled";
  }

  return "missing";
}

function findFeaturesRange(lines: string[]): { start: number; end: number } | null {
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].trim();
    if (header.startsWith("[") && header.endsWith("]")) {
      if (header === FEATURES_HEADER) {
        start = i;
        continue;
      }
      if (start >= 0) {
        end = i;
        break;
      }
    }
  }
  return start >= 0 ? { start, end } : null;
}

function findFeatureKey(lines: string[], start: number, end: number, key: string): number {
  for (let i = start + 1; i < end; i++) {
    if (new RegExp(`^\\s*${key}\\s*=`).test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function readBooleanValue(line: string): boolean {
  return !/\bfalse\b/i.test(line);
}

function removeDuplicateFeatureKeys(lines: string[], start: number, end: number, key: string, keepIndex: number): void {
  for (let i = end - 1; i > start; i--) {
    if (i === keepIndex) continue;
    if (new RegExp(`^\\s*${key}\\s*=`).test(lines[i])) {
      lines.splice(i, 1);
    }
  }
}

function normalizeToml(lines: string[], newline: string): string {
  return `${lines.join(newline).replace(/\s*$/, "")}${newline}`;
}
