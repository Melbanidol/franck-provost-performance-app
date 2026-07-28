import { DataSource } from 'typeorm';
import { DayType, EmployeeLevel, RateTier } from '../entities/enums';

// Seeds the concrete constants given in the spec, all editable later via
// formula_settings / level_targets / performance_tiers / rate_card without a
// redeploy (§4.3, §6.1, §6.4-§6.7, §7.1). Idempotent: safe to re-run.
// Shared between the standalone `npm run seed` CLI entry point
// (run-seeds.ts) and the calc engine integration check
// (verify-calc-engine.ts), which needs to re-seed after truncating —
// TRUNCATE ... CASCADE on employees also wipes formula_settings via its
// updated_by FK, even though that FK is ON DELETE SET NULL.
export async function seedReferenceData(dataSource: DataSource): Promise<void> {
  // §6.6 — avg spend target by professional level.
  const levelTargets: { level: EmployeeLevel; avgSpendTarget: number }[] = [
    { level: EmployeeLevel.EMERGING_STYLIST, avgSpendTarget: 200 },
    { level: EmployeeLevel.SENIOR_STYLIST, avgSpendTarget: 220 },
    { level: EmployeeLevel.ADVANCED_SENIOR_STYLIST, avgSpendTarget: 240 },
    { level: EmployeeLevel.MASTER_STYLIST, avgSpendTarget: 260 },
    { level: EmployeeLevel.HEAD_STYLIST, avgSpendTarget: 280 },
  ];
  for (const row of levelTargets) {
    await dataSource.query(
      `INSERT INTO "level_targets" ("level", "avg_spend_target")
       VALUES ($1, $2)
       ON CONFLICT ("level") DO UPDATE SET "avg_spend_target" = EXCLUDED."avg_spend_target", "updated_at" = now()`,
      [row.level, row.avgSpendTarget],
    );
  }

  // §4.3 — official Career & Benefits 2026 hourly pay grid (excl. GST).
  // No head_stylist row: freelancers have no hourly rate at all.
  const rateCard: { level: RateTier; dayType: DayType; rate: number }[] = [
    { level: RateTier.SENIOR_STYLIST, dayType: DayType.WEEKDAY, rate: 29.5 },
    { level: RateTier.SENIOR_STYLIST, dayType: DayType.SATURDAY, rate: 39.2 },
    { level: RateTier.SENIOR_STYLIST, dayType: DayType.SUNDAY, rate: 58.9 },
    { level: RateTier.SENIOR_STYLIST, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },

    { level: RateTier.ADVANCED_SENIOR_STYLIST, dayType: DayType.WEEKDAY, rate: 30.5 },
    { level: RateTier.ADVANCED_SENIOR_STYLIST, dayType: DayType.SATURDAY, rate: 40.3 },
    { level: RateTier.ADVANCED_SENIOR_STYLIST, dayType: DayType.SUNDAY, rate: 59.1 },
    { level: RateTier.ADVANCED_SENIOR_STYLIST, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },

    { level: RateTier.MASTER_STYLIST, dayType: DayType.WEEKDAY, rate: 32.0 },
    { level: RateTier.MASTER_STYLIST, dayType: DayType.SATURDAY, rate: 40.8 },
    { level: RateTier.MASTER_STYLIST, dayType: DayType.SUNDAY, rate: 60.6 },
    { level: RateTier.MASTER_STYLIST, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },

    { level: RateTier.EMERGING_STYLIST, dayType: DayType.WEEKDAY, rate: 28.5 },
    { level: RateTier.EMERGING_STYLIST, dayType: DayType.SATURDAY, rate: 38.2 },
    { level: RateTier.EMERGING_STYLIST, dayType: DayType.SUNDAY, rate: 57.0 },
    { level: RateTier.EMERGING_STYLIST, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },

    { level: RateTier.CASUAL, dayType: DayType.WEEKDAY, rate: 36.81 },
    { level: RateTier.CASUAL, dayType: DayType.SATURDAY, rate: 46.53 },
    { level: RateTier.CASUAL, dayType: DayType.SUNDAY, rate: 66.26 },
    { level: RateTier.CASUAL, dayType: DayType.PUBLIC_HOLIDAY, rate: 73.63 },
  ];
  for (const row of rateCard) {
    await dataSource.query(
      `INSERT INTO "rate_card" ("level", "day_type", "rate")
       VALUES ($1, $2, $3)
       ON CONFLICT ("level", "day_type") DO UPDATE SET "rate" = EXCLUDED."rate"`,
      [row.level, row.dayType, row.rate],
    );
  }

  // §6.1 service_target = weighted_wage × 1.2 × 3, §6.4 retail = $14/h,
  // §6.5/§6.7 fixed-percentage targets, §3 GST rate for the "incl. GST"
  // toggle, §6.8 commission rates (contracted 30%/20%) and §4.3's flat
  // freelancer service commission (40%, no threshold at all).
  const formulaSettings: { key: string; value: number }[] = [
    { key: 'service_multiplier_1', value: 1.2 },
    { key: 'service_multiplier_2', value: 3 },
    { key: 'retail_hourly_rate', value: 14 },
    { key: 'rebooking_target_pct', value: 50 },
    { key: 'treatment_conversion_target_pct', value: 50 },
    { key: 'retail_conversion_target_pct', value: 50 },
    { key: 'gst_rate_pct', value: 10 },
    { key: 'retail_commission_pct', value: 20 },
    { key: 'service_commission_pct', value: 30 },
    { key: 'freelancer_service_commission_pct', value: 40 },
  ];
  for (const row of formulaSettings) {
    await dataSource.query(
      `INSERT INTO "formula_settings" ("key", "value", "updated_at")
       VALUES ($1, $2, now())
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()`,
      [row.key, row.value],
    );
  }

  // §7.1 — overperformance tiers. Bonus amounts explicitly not finalized yet.
  const performanceTiers = [
    { tierNumber: 1, thresholdPct: 10 },
    { tierNumber: 2, thresholdPct: 20 },
    { tierNumber: 3, thresholdPct: 30 },
    { tierNumber: 4, thresholdPct: 40 },
    { tierNumber: 5, thresholdPct: 50 },
  ];
  for (const row of performanceTiers) {
    await dataSource.query(
      `INSERT INTO "performance_tiers" ("tier_number", "threshold_pct")
       VALUES ($1, $2)
       ON CONFLICT ("tier_number") DO UPDATE SET "threshold_pct" = EXCLUDED."threshold_pct"`,
      [row.tierNumber, row.thresholdPct],
    );
  }

  // Simple Salon's own "Roster Types" (§4.1 roster sync) — confirmed which
  // are paid. Paid = counts toward service_target/retail_target/contracted-
  // hours quota alike; unpaid blocks are still synced into roster_hours for
  // a full record, they just never reach the calc engine.
  const rosterTypes: { name: string; isPaid: boolean }[] = [
    { name: 'Rostered ON', isPaid: true },
    { name: 'Sick', isPaid: true },
    { name: 'Public Holiday', isPaid: true },
    { name: 'Annual Leave', isPaid: true },
    { name: 'TAFE', isPaid: false },
    { name: 'Training', isPaid: true },
    { name: 'Compassionate Leave', isPaid: true },
    { name: 'Customer Service', isPaid: false },
    { name: 'Events/Wellness Circle', isPaid: false },
    { name: 'FP Team Day', isPaid: true },
    { name: 'Franchisees Meeting', isPaid: false },
    { name: 'Home Office', isPaid: false },
    { name: 'Jury duty', isPaid: true },
    { name: 'Lunch', isPaid: false },
    { name: 'Manager Meeting (15 min)', isPaid: true },
    { name: 'Manager Meeting (420 min)', isPaid: true },
    { name: 'Maternity', isPaid: false },
    { name: 'Rostered OFF', isPaid: false },
    { name: 'TCU', isPaid: true },
    { name: 'Time Owed', isPaid: false },
    { name: 'Unpaid Leave', isPaid: false },
    { name: 'Unpaid Training', isPaid: false },
    { name: 'Wellbeing Day', isPaid: true },
  ];
  for (const row of rosterTypes) {
    await dataSource.query(
      `INSERT INTO "roster_types" ("name", "is_paid")
       VALUES ($1, $2)
       ON CONFLICT ("name") DO UPDATE SET "is_paid" = EXCLUDED."is_paid"`,
      [row.name, row.isPaid],
    );
  }
}
