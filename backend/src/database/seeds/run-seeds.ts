import { AppDataSource } from '../../config/data-source';
import { EmployeeLevel } from '../entities/enums';

// Seeds the concrete constants given in the spec, all editable later via
// formula_settings / level_targets / performance_tiers without a redeploy
// (§6.1, §6.4-§6.7, §7.1). Idempotent: safe to re-run.
async function run() {
  const dataSource = await AppDataSource.initialize();

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

  // §6.1 service_target = gross_wage × 1.2 × 3, §6.4 retail = $14/h,
  // §6.5/§6.7 fixed-percentage targets, §3 GST rate for the "incl. GST" toggle.
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

  await dataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('Seed complete: level_targets, formula_settings, performance_tiers');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
