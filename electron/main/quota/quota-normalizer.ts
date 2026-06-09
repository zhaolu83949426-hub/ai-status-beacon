import type { QuotaTier } from "../../../shared/types";

const TIER_PRIORITY = ["five_hour", "weekly_limit", "seven_day", "premium"];

export function sortAndLimitTiers(tiers: QuotaTier[], maxPerAccount = 2): QuotaTier[] {
  const sorted = [...tiers].sort((a, b) => {
    const aIdx = TIER_PRIORITY.indexOf(a.name);
    const bIdx = TIER_PRIORITY.indexOf(b.name);
    const aP = aIdx === -1 ? TIER_PRIORITY.length : aIdx;
    const bP = bIdx === -1 ? TIER_PRIORITY.length : bIdx;
    return aP - bP;
  });
  return sorted.slice(0, maxPerAccount);
}

export function utilizationFromRemaining(remaining: number, total?: number): number {
  // remaining is 0-1 fraction or 0-100 percentage
  if (total !== undefined) {
    return Math.round(((total - remaining) / total) * 100);
  }
  // Assume remaining is 0-100
  return Math.round(100 - remaining);
}

export function utilizationFromFraction(fraction: number): number {
  // fraction is 0-1 remaining fraction
  return Math.round((1 - fraction) * 100);
}
