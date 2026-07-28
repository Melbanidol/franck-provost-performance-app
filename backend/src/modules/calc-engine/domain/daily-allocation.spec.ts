import { allocateWeeklyTargetToDays, computeDailyRetailTarget } from './daily-allocation';

describe('allocateWeeklyTargetToDays', () => {
  it('splits the weekly target proportionally to weighted hours (§6.2)', () => {
    // Monday: 20h × $29.50 = 590 weighted; Saturday: 8h × $39.20 = 313.6 weighted.
    const days = [
      { date: '2026-08-03', weightedHours: 590 },
      { date: '2026-08-08', weightedHours: 313.6 },
    ];
    const result = allocateWeeklyTargetToDays(3252.96, days);

    const monday = result.get('2026-08-03')!;
    const saturday = result.get('2026-08-08')!;

    // Proportional: monday/saturday share ratio matches weighted hours ratio.
    expect(monday / saturday).toBeCloseTo(590 / 313.6, 6);
    // Shares sum back to the full weekly target.
    expect(monday + saturday).toBeCloseTo(3252.96, 6);
  });

  it('returns 0 for every day when total weighted hours is 0 (no divide-by-zero)', () => {
    const result = allocateWeeklyTargetToDays(1000, [
      { date: '2026-08-03', weightedHours: 0 },
      { date: '2026-08-04', weightedHours: 0 },
    ]);
    expect(result.get('2026-08-03')).toBe(0);
    expect(result.get('2026-08-04')).toBe(0);
  });
});

describe('computeDailyRetailTarget', () => {
  it('is $14 × hours for that day, unweighted by day type (§6.4)', () => {
    expect(computeDailyRetailTarget(8, 14)).toBe(112);
  });
});
