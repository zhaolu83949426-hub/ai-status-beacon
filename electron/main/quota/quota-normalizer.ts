import type { QuotaTier } from "../../../shared/types";

const TIER_PRIORITY: Record<string, number> = {
  five_hour: 0,
  weekly_limit: 1,
  seven_day: 2,
  premium: 3,
};

export function sortAndLimitTiers(tiers: QuotaTier[], maxPerAccount = 2): QuotaTier[] {
  const seen = new Set<string>();
  const deduped = tiers.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
  const sorted = [...deduped].sort((a, b) => {
    const aP = TIER_PRIORITY[a.name] ?? 99;
    const bP = TIER_PRIORITY[b.name] ?? 99;
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
