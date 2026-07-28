import { DayType, EmployeeLevel, EmploymentType, RateTier } from '../../../database/entities/enums';
import { buildRateCardLookup } from './rate-resolution';
import {
  computeServiceTarget,
  computeWeightedWageForSalon,
  hasServiceTarget,
} from './service-target';

const rateCard = buildRateCardLookup([
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.WEEKDAY, rate: 29.5 },
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.SATURDAY, rate: 39.2 },
  { level: RateTier.CASUAL, dayType: DayType.WEEKDAY, rate: 36.81 },
]);

describe('hasServiceTarget', () => {
  it('is true only for contracted', () => {
    expect(hasServiceTarget(EmploymentType.CONTRACTED)).toBe(true);
    expect(hasServiceTarget(EmploymentType.CASUAL)).toBe(false);
    expect(hasServiceTarget(EmploymentType.FREELANCER)).toBe(false);
  });
});

describe('computeWeightedWageForSalon', () => {
  it('sums hours × rate per day at the primary salon, own level', () => {
    // A senior stylist: 20h weekday + 8h saturday at their primary salon.
    const wage = computeWeightedWageForSalon({
      dailyHours: [
        { date: '2026-08-03', dayType: DayType.WEEKDAY, hoursScheduled: 20 },
        { date: '2026-08-08', dayType: DayType.SATURDAY, hoursScheduled: 8 },
      ],
      employmentType: EmploymentType.CONTRACTED,
      level: EmployeeLevel.SENIOR_STYLIST,
      isPrimarySalon: true,
      rateCard,
    });
    // 20 * 29.50 + 8 * 39.20 = 590 + 313.6
    expect(wage).toBeCloseTo(903.6, 6);
  });

  it('uses the casual rate for the same hours at a secondary salon', () => {
    const wage = computeWeightedWageForSalon({
      dailyHours: [{ date: '2026-08-04', dayType: DayType.WEEKDAY, hoursScheduled: 5 }],
      employmentType: EmploymentType.CONTRACTED,
      level: EmployeeLevel.SENIOR_STYLIST,
      isPrimarySalon: false,
      rateCard,
    });
    // 5 * 36.81
    expect(wage).toBeCloseTo(184.05, 6);
  });

  it('returns 0 for freelancer (defensive — callers should gate with hasServiceTarget)', () => {
    const wage = computeWeightedWageForSalon({
      dailyHours: [{ date: '2026-08-03', dayType: DayType.WEEKDAY, hoursScheduled: 20 }],
      employmentType: EmploymentType.FREELANCER,
      level: EmployeeLevel.HEAD_STYLIST,
      isPrimarySalon: true,
      rateCard,
    });
    expect(wage).toBe(0);
  });
});

describe('computeServiceTarget', () => {
  it('applies §6.1 weighted_wage × multiplier1 × multiplier2', () => {
    // 903.6 × 1.2 × 3
    expect(computeServiceTarget(903.6, 1.2, 3)).toBeCloseTo(3252.96, 6);
  });
});
