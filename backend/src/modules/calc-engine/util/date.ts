// Plain calendar-date arithmetic on 'YYYY-MM-DD' strings. Safe to do with
// UTC here: by the time a date reaches roster_hours/daily_performance it has
// already been bucketed into the correct salon-local day by the sync job
// (§6.9) — this just walks 7 consecutive calendar dates, no timezone
// conversion involved.
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
