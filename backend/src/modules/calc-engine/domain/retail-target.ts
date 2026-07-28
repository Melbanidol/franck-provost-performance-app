import { EmploymentType } from '../../../database/entities/enums';

// §4.3 — freelancer has no retail target ("N/A, pas de cible").
export function hasRetailTarget(employmentType: EmploymentType): boolean {
  return employmentType !== EmploymentType.FREELANCER;
}

// §6.4 — retail_target = $14/h × total hours scheduled in that salon,
// uniform regardless of day type or the employee's own/casual rate.
export function computeRetailTarget(totalHoursScheduled: number, retailHourlyRate: number): number {
  return totalHoursScheduled * retailHourlyRate;
}
