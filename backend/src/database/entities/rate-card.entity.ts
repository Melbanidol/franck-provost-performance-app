import { Column, PrimaryColumn } from 'typeorm';
import { Entity } from 'typeorm';
import { DayType, RateTier } from './enums';

// §5 rate_card — official Career & Benefits 2026 pay grid (§4.3), replaces
// the previous per-employee employee_rates table. It's a pure lookup: which
// rate applies is resolved by employment_type/level at calc time (contracted
// → rate_card[employee.level], casual or extra hours in a non-primary salon
// → rate_card[casual]), not stored on the employee. No row for head_stylist
// (freelancer, no hourly rate — flat commission instead, §4.3/§6.8).
@Entity('rate_card')
export class RateCard {
  @PrimaryColumn({
    type: 'enum',
    enum: RateTier,
    enumName: 'rate_tier_enum',
  })
  level: RateTier;

  @PrimaryColumn({
    name: 'day_type',
    type: 'enum',
    enum: DayType,
    enumName: 'day_type_enum',
  })
  dayType: DayType;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  rate: string;
}
