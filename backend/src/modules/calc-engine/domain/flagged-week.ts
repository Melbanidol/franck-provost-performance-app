// §6.3 — "toute déviation ... pas de seuil de tolérance": exact comparison,
// no wiggle room. Only meaningful for employment_type = 'contracted'
// (enforced at the DB level: contracted_hours_per_week is null otherwise).
export function hasHoursDeviation(contractedHours: number, totalScheduledHours: number): boolean {
  return contractedHours !== totalScheduledHours;
}
