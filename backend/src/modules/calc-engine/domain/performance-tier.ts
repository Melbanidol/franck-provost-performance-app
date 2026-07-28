export interface TierDefinition {
  tierNumber: number;
  thresholdPct: number;
}

// §7.1 — undefined (null) when there's no service_target to overperform
// against (casual/freelancer, §4.3), not the same as 0% overperformance.
export function computeOverperformancePct(
  serviceActual: number,
  serviceTarget: number | null,
): number | null {
  if (serviceTarget === null || serviceTarget === 0) {
    return null;
  }
  return ((serviceActual - serviceTarget) / serviceTarget) * 100;
}

// Highest tier whose threshold is met; null if none (or not applicable).
export function resolveTierReached(
  overperformancePct: number | null,
  tiers: TierDefinition[],
): number | null {
  if (overperformancePct === null) {
    return null;
  }
  let best: TierDefinition | null = null;
  for (const tier of tiers) {
    if (overperformancePct >= tier.thresholdPct && (best === null || tier.thresholdPct > best.thresholdPct)) {
      best = tier;
    }
  }
  return best ? best.tierNumber : null;
}
