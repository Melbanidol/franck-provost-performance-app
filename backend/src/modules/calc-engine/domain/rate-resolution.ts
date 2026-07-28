import { DayType, EmployeeLevel, EmploymentType, RateTier } from '../../../database/entities/enums';

// Flat lookup built from the rate_card table: "level:day_type" -> rate.
export type RateCardLookup = Map<string, number>;

export function rateCardKey(level: RateTier, dayType: DayType): string {
  return `${level}:${dayType}`;
}

export function buildRateCardLookup(
  rows: { level: RateTier; dayType: DayType; rate: number }[],
): RateCardLookup {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(rateCardKey(row.level, row.dayType), row.rate);
  }
  return map;
}

// employees.level and rate_card.level are deliberately different enums (see
// rate-card.entity.ts) — this is the only place that bridges them, and it's
// only ever called for a 'contracted' employee at their primary salon, where
// head_stylist can never appear (CHECK constraint: head_stylist <=> freelancer).
function levelToRateTier(level: EmployeeLevel): RateTier {
  switch (level) {
    case EmployeeLevel.EMERGING_STYLIST:
      return RateTier.EMERGING_STYLIST;
    case EmployeeLevel.SENIOR_STYLIST:
      return RateTier.SENIOR_STYLIST;
    case EmployeeLevel.ADVANCED_SENIOR_STYLIST:
      return RateTier.ADVANCED_SENIOR_STYLIST;
    case EmployeeLevel.MASTER_STYLIST:
      return RateTier.MASTER_STYLIST;
    case EmployeeLevel.HEAD_STYLIST:
      throw new Error('head_stylist has no rate_card entry — always freelancer (§4.3), no hourly rate');
  }
}

// §4.3 / §6.10 revised — resolves the hourly rate that applies to a given
// employee, for hours worked on a given day type, in a given salon:
//  - freelancer: no hourly rate at all (null) — flat commission only.
//  - casual: always the flat casual rate_card rate, in every salon.
//  - contracted, primary salon: their own level's rate_card rate.
//  - contracted, secondary (non-primary) salon: "Extra Hours ... paid at a
//    casual rate" — the flat casual rate_card rate, regardless of level.
export function resolveHourlyRate(params: {
  employmentType: EmploymentType;
  level: EmployeeLevel;
  isPrimarySalon: boolean;
  dayType: DayType;
  rateCard: RateCardLookup;
}): number | null {
  const { employmentType, level, isPrimarySalon, dayType, rateCard } = params;

  if (employmentType === EmploymentType.FREELANCER) {
    return null;
  }

  const tier =
    employmentType === EmploymentType.CASUAL || !isPrimarySalon
      ? RateTier.CASUAL
      : levelToRateTier(level);

  const rate = rateCard.get(rateCardKey(tier, dayType));
  if (rate === undefined) {
    throw new Error(`No rate_card entry for level=${tier} day_type=${dayType}`);
  }
  return rate;
}
