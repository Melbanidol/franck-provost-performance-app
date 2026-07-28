export interface WeightedDay {
  date: string;
  weightedHours: number;
}

// §6.2 — proportionally splits a weekly $ target across the days it was
// earned on, weighted by heures_planifiées(jour) × taux_horaire(jour). If a
// week has zero weighted hours (e.g. no target — casual/freelancer, or
// nothing rostered), every day gets 0 rather than dividing by zero.
export function allocateWeeklyTargetToDays(
  weeklyTarget: number,
  days: WeightedDay[],
): Map<string, number> {
  const totalWeighted = days.reduce((sum, d) => sum + d.weightedHours, 0);
  const result = new Map<string, number>();
  for (const day of days) {
    result.set(day.date, totalWeighted === 0 ? 0 : weeklyTarget * (day.weightedHours / totalWeighted));
  }
  return result;
}

// §6.4 — daily retail target is NOT weighted by day type, unlike service.
export function computeDailyRetailTarget(hoursScheduled: number, retailHourlyRate: number): number {
  return hoursScheduled * retailHourlyRate;
}
