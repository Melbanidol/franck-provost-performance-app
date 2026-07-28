import { EmploymentType } from '../../../database/entities/enums';

// Confirmed: freelancers have no targets of any kind — not just
// service/retail (§4.3), but also rebooking, avg spend, and the
// treatment/retail conversion targets. The MVP is scoped to contracted
// employees; casual keeps its existing partial targets (retail only) for
// now, freelancer gets none. No kpi_targets/daily_targets row is created for
// a freelancer at all — they still earn commissions (§6.8), just with no
// target concept behind them.
export function hasAnyTargets(employmentType: EmploymentType): boolean {
  return employmentType !== EmploymentType.FREELANCER;
}
