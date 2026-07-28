import { DayType, EmployeeLevel, EmploymentType } from '../../../database/entities/enums';
import { RateCardLookup, resolveHourlyRate } from './rate-resolution';

export interface DailyHours {
  date: string;
  dayType: DayType;
  hoursScheduled: number;
}

// §4.3 — only 'contracted' has a service target at all.
export function hasServiceTarget(employmentType: EmploymentType): boolean {
  return employmentType === EmploymentType.CONTRACTED;
}

// §6.10 revised — the "implicit" wage for one salon, computed directly from
// that salon's rostered hours and the official rate_card (not prorated from
// Xero's single gross_wage). Returns 0 for employment types with no hourly
// rate (defensive; callers should gate with hasServiceTarget first).
export function computeWeightedWageForSalon(params: {
  dailyHours: DailyHours[];
  employmentType: EmploymentType;
  level: EmployeeLevel;
  isPrimarySalon: boolean;
  rateCard: RateCardLookup;
}): number {
  const { dailyHours, employmentType, level, isPrimarySalon, rateCard } = params;
  let total = 0;
  for (const day of dailyHours) {
    const rate = resolveHourlyRate({
      employmentType,
      level,
      isPrimarySalon,
      dayType: day.dayType,
      rateCard,
    });
    if (rate === null) return 0;
    total += day.hoursScheduled * rate;
  }
  return total;
}

// §6.1 / §6.10 — service_target(salon) = weighted_wage(salon) × multiplier1 × multiplier2
export function computeServiceTarget(
  weightedWage: number,
  multiplier1: number,
  multiplier2: number,
): number {
  return weightedWage * multiplier1 * multiplier2;
}
