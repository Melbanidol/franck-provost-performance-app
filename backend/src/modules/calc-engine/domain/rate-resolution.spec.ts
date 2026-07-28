import { DayType, EmployeeLevel, EmploymentType, RateTier } from '../../../database/entities/enums';
import { buildRateCardLookup, resolveHourlyRate } from './rate-resolution';

// Real §4.3 Career & Benefits 2026 grid (excl. GST).
const rateCard = buildRateCardLookup([
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.WEEKDAY, rate: 29.5 },
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.SATURDAY, rate: 39.2 },
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.SUNDAY, rate: 58.9 },
  { level: RateTier.SENIOR_STYLIST, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },
  { level: RateTier.CASUAL, dayType: DayType.WEEKDAY, rate: 36.81 },
  { level: RateTier.CASUAL, dayType: DayType.SATURDAY, rate: 46.53 },
]);

describe('resolveHourlyRate', () => {
  it('returns null for freelancer regardless of salon or day', () => {
    expect(
      resolveHourlyRate({
        employmentType: EmploymentType.FREELANCER,
        level: EmployeeLevel.HEAD_STYLIST,
        isPrimarySalon: true,
        dayType: DayType.WEEKDAY,
        rateCard,
      }),
    ).toBeNull();
  });

  it('always uses the casual rate for casual employees, even at their primary salon', () => {
    const rate = resolveHourlyRate({
      employmentType: EmploymentType.CASUAL,
      level: EmployeeLevel.SENIOR_STYLIST,
      isPrimarySalon: true,
      dayType: DayType.WEEKDAY,
      rateCard,
    });
    expect(rate).toBe(36.81);
  });

  it('uses the employee own-level rate for contracted at their primary salon', () => {
    const rate = resolveHourlyRate({
      employmentType: EmploymentType.CONTRACTED,
      level: EmployeeLevel.SENIOR_STYLIST,
      isPrimarySalon: true,
      dayType: DayType.SATURDAY,
      rateCard,
    });
    expect(rate).toBe(39.2);
  });

  it('uses the casual rate for contracted hours worked at a secondary salon (§6.10 "Extra Hours")', () => {
    const rate = resolveHourlyRate({
      employmentType: EmploymentType.CONTRACTED,
      level: EmployeeLevel.SENIOR_STYLIST,
      isPrimarySalon: false,
      dayType: DayType.SATURDAY,
      rateCard,
    });
    expect(rate).toBe(46.53);
  });

  it('throws when the rate_card has no entry for the resolved tier/day_type', () => {
    expect(() =>
      resolveHourlyRate({
        employmentType: EmploymentType.CONTRACTED,
        level: EmployeeLevel.SENIOR_STYLIST,
        isPrimarySalon: true,
        dayType: DayType.SUNDAY,
        rateCard: buildRateCardLookup([]),
      }),
    ).toThrow(/No rate_card entry/);
  });
});
