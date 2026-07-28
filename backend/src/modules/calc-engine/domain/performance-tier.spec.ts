import { computeOverperformancePct, resolveTierReached, TierDefinition } from './performance-tier';

const tiers: TierDefinition[] = [
  { tierNumber: 1, thresholdPct: 10 },
  { tierNumber: 2, thresholdPct: 20 },
  { tierNumber: 3, thresholdPct: 30 },
  { tierNumber: 4, thresholdPct: 40 },
  { tierNumber: 5, thresholdPct: 50 },
];

describe('computeOverperformancePct', () => {
  it('is null when there is no service_target (casual/freelancer)', () => {
    expect(computeOverperformancePct(5000, null)).toBeNull();
  });

  it('computes (actual - target) / target × 100', () => {
    // (4000 - 3252.96) / 3252.96 * 100
    expect(computeOverperformancePct(4000, 3252.96)).toBeCloseTo(22.966, 2);
  });
});

describe('resolveTierReached', () => {
  it('returns null when overperformance is null', () => {
    expect(resolveTierReached(null, tiers)).toBeNull();
  });

  it('returns null when below every threshold', () => {
    expect(resolveTierReached(5, tiers)).toBeNull();
  });

  it('returns the highest tier whose threshold is met', () => {
    expect(resolveTierReached(22.966, tiers)).toBe(2);
  });

  it('caps at the top tier for very large overperformance', () => {
    expect(resolveTierReached(500, tiers)).toBe(5);
  });

  it('is inclusive at the exact threshold', () => {
    expect(resolveTierReached(50, tiers)).toBe(5);
  });
});
