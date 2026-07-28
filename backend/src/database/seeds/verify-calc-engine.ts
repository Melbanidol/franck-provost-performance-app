import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { CalcEngineService } from '../../modules/calc-engine/calc-engine.service';
import { seedReferenceData } from './seed-reference-data';

// End-to-end verification of the §6 calc engine against a real Postgres
// instance: seeds a realistic multi-employee/multi-salon scenario, runs
// CalcEngineService.recalculateEmployeeWeek for each employee, then asserts
// the persisted kpi_targets/daily_targets/employee_commissions/
// employee_performance_tier/flagged_weeks rows against expected values
// computed independently (plain arithmetic, not by calling the domain
// functions under test — this checks the wiring, not the formulas, which
// already have their own unit tests in domain/*.spec.ts).
//
// Not a permanent CI suite — a one-off gate for this phase of the build.
// Run with: npm run verify:calc-engine

const WEEK_START = '2026-08-03'; // Monday

function assertClose(label: string, actual: unknown, expected: number, tolerance = 0.02): void {
  const value = actual === null || actual === undefined ? null : parseFloat(String(actual));
  if (value === null || Math.abs(value - expected) > tolerance) {
    throw new Error(`FAIL ${label}: expected ~${expected}, got ${actual}`);
  }
  console.log(`OK   ${label}: ${actual} (~${expected})`);
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`FAIL ${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK   ${label}: ${actual}`);
}

function assertNull(label: string, actual: unknown): void {
  if (actual !== null) {
    throw new Error(`FAIL ${label}: expected null, got ${actual}`);
  }
  console.log(`OK   ${label}: null`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const dataSource = app.get(DataSource);
  const calcEngine = app.get(CalcEngineService);

  await dataSource.query(
    `TRUNCATE TABLE flagged_weeks, employee_performance_tier, employee_commissions,
      daily_targets, kpi_targets, daily_performance, roster_hours,
      employee_salon_assignments, employees, salons RESTART IDENTITY CASCADE`,
  );
  // TRUNCATE ... CASCADE on employees also wipes formula_settings (its
  // updated_by FK references employees, even though ON DELETE SET NULL) —
  // reseed the reference data every run so it's always in a known state.
  await seedReferenceData(dataSource);

  const [{ id: salonA }] = await dataSource.query(
    `INSERT INTO salons (name, timezone) VALUES ('Salon A', 'Australia/Sydney') RETURNING id`,
  );
  const [{ id: salonB }] = await dataSource.query(
    `INSERT INTO salons (name, timezone) VALUES ('Salon B', 'Australia/Sydney') RETURNING id`,
  );

  async function insertEmployee(row: {
    firstName: string;
    lastName: string;
    employmentType: string;
    level: string;
    contractedHours: number | null;
  }): Promise<string> {
    const [{ id }] = await dataSource.query(
      `INSERT INTO employees (first_name, last_name, role, employment_type, level, contracted_hours_per_week)
       VALUES ($1, $2, 'stylist', $3, $4, $5) RETURNING id`,
      [row.firstName, row.lastName, row.employmentType, row.level, row.contractedHours],
    );
    return id;
  }

  async function assign(employeeId: string, salonId: string, isPrimary: boolean): Promise<void> {
    await dataSource.query(
      `INSERT INTO employee_salon_assignments (employee_id, salon_id, is_active, is_primary, first_seen_roster_date, last_seen_roster_date)
       VALUES ($1, $2, true, $3, $4, $4)`,
      [employeeId, salonId, isPrimary, WEEK_START],
    );
  }

  async function roster(
    employeeId: string,
    salonId: string,
    date: string,
    dayType: string,
    hours: number,
    rosterType = 'Rostered ON',
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO roster_hours (employee_id, salon_id, date, roster_type, day_type, hours_scheduled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [employeeId, salonId, date, rosterType, dayType, hours],
    );
  }

  async function actuals(
    employeeId: string,
    salonId: string,
    date: string,
    serviceSales: number,
    retailSales: number,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO daily_performance (employee_id, salon_id, date, service_sales, retail_sales)
       VALUES ($1, $2, $3, $4, $5)`,
      [employeeId, salonId, date, serviceSales, retailSales],
    );
  }

  // --- Scenario A: contracted senior stylist, single (primary) salon, no deviation ---
  const empA = await insertEmployee({
    firstName: 'A',
    lastName: 'Contracted',
    employmentType: 'contracted',
    level: 'senior_stylist',
    contractedHours: 30,
  });
  await assign(empA, salonA, true);
  await roster(empA, salonA, '2026-08-03', 'weekday', 8);
  await roster(empA, salonA, '2026-08-04', 'weekday', 8);
  await roster(empA, salonA, '2026-08-05', 'weekday', 8);
  await roster(empA, salonA, '2026-08-08', 'saturday', 6);
  await actuals(empA, salonA, '2026-08-03', 2000, 200);
  await actuals(empA, salonA, '2026-08-04', 2200, 300);
  // service total 4200, retail total 500

  // --- Scenario B: casual emerging stylist ---
  const empB = await insertEmployee({
    firstName: 'B',
    lastName: 'Casual',
    employmentType: 'casual',
    level: 'emerging_stylist',
    contractedHours: null,
  });
  await assign(empB, salonA, true);
  await roster(empB, salonA, '2026-08-03', 'weekday', 8);
  await roster(empB, salonA, '2026-08-04', 'weekday', 8);
  await actuals(empB, salonA, '2026-08-03', 600, 150);
  await actuals(empB, salonA, '2026-08-04', 400, 150);
  // service total 1000 (irrelevant — no target/commission), retail total 300

  // --- Scenario C: freelancer head stylist ---
  const empC = await insertEmployee({
    firstName: 'C',
    lastName: 'Freelancer',
    employmentType: 'freelancer',
    level: 'head_stylist',
    contractedHours: null,
  });
  await assign(empC, salonA, true);
  await roster(empC, salonA, '2026-08-03', 'weekday', 8);
  await roster(empC, salonA, '2026-08-04', 'weekday', 8);
  await roster(empC, salonA, '2026-08-05', 'weekday', 8);
  await actuals(empC, salonA, '2026-08-03', 3000, 500);
  await actuals(empC, salonA, '2026-08-04', 2000, 300);
  // service total 5000, retail total 800

  // --- Scenario D: contracted senior stylist with an hours deviation ---
  const empD = await insertEmployee({
    firstName: 'D',
    lastName: 'Flagged',
    employmentType: 'contracted',
    level: 'senior_stylist',
    contractedHours: 38,
  });
  await assign(empD, salonA, true);
  await roster(empD, salonA, '2026-08-03', 'weekday', 8);
  await roster(empD, salonA, '2026-08-04', 'weekday', 8);
  await roster(empD, salonA, '2026-08-05', 'weekday', 8);
  await roster(empD, salonA, '2026-08-06', 'weekday', 8);
  // 32h scheduled vs 38h contracted -> deviation

  // --- Scenario E: contracted master stylist, primary + secondary salon ---
  const empE = await insertEmployee({
    firstName: 'E',
    lastName: 'MultiSalon',
    employmentType: 'contracted',
    level: 'master_stylist',
    contractedHours: 29,
  });
  await assign(empE, salonA, true);
  await assign(empE, salonB, false);
  await roster(empE, salonA, '2026-08-03', 'weekday', 8);
  await roster(empE, salonA, '2026-08-04', 'weekday', 8);
  await roster(empE, salonA, '2026-08-05', 'weekday', 8);
  await roster(empE, salonB, '2026-08-06', 'weekday', 5);
  // 24h primary + 5h secondary = 29h total -> matches contract, no deviation

  // --- Scenario F: mixed paid/unpaid roster_type blocks in the same week ---
  const empF = await insertEmployee({
    firstName: 'F',
    lastName: 'MixedRosterTypes',
    employmentType: 'contracted',
    level: 'advanced_senior_stylist',
    contractedHours: 14,
  });
  await assign(empF, salonA, true);
  // Wed: two paid blocks, same day, different roster_type -> should sum to 8h
  await roster(empF, salonA, '2026-08-05', 'weekday', 4, 'Rostered ON');
  await roster(empF, salonA, '2026-08-05', 'weekday', 4, 'Training');
  // Thu: one paid block (6h) + one unpaid block (3h Home Office) -> only 6h should count
  await roster(empF, salonA, '2026-08-06', 'weekday', 6, 'Rostered ON');
  await roster(empF, salonA, '2026-08-06', 'weekday', 3, 'Home Office');
  // Fri: fully unpaid day -> should not appear in targets/daily_targets at all
  await roster(empF, salonA, '2026-08-07', 'weekday', 5, 'Home Office');
  // total PAID hours = 8 (Wed) + 6 (Thu) + 0 (Fri) = 14h -> matches 14h contract, no deviation

  for (const employeeId of [empA, empB, empC, empD, empE, empF]) {
    await calcEngine.recalculateEmployeeWeek(employeeId, WEEK_START);
  }

  console.log('\n=== Scenario A: contracted, single salon ===');
  {
    const [kpi] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empA, salonA],
    );
    // weighted_wage = 24h*29.50 + 6h*39.20 = 708 + 235.2 = 943.2
    // service_target = 943.2 * 1.2 * 3 = 3395.52
    assertClose('A service_target', kpi.service_target, 3395.52);
    // retail_target = 30h * 14 = 420
    assertClose('A retail_target', kpi.retail_target, 420);
    assertClose('A rebooking_target', kpi.rebooking_target, 50);
    assertClose('A avg_spend_target (senior_stylist)', kpi.avg_spend_target, 220);

    const dailyRows: { date: string; daily_retail_target: string }[] = await dataSource.query(
      `SELECT date, daily_retail_target FROM daily_targets WHERE employee_id = $1 AND salon_id = $2 ORDER BY date`,
      [empA, salonA],
    );
    const retailSum = dailyRows.reduce((sum, r) => sum + parseFloat(r.daily_retail_target), 0);
    assertClose('A daily_retail_target sum', retailSum, 420);

    const [commission] = await dataSource.query(
      `SELECT * FROM employee_commissions WHERE employee_id = $1 AND salon_id = $2`,
      [empA, salonA],
    );
    assertEqual('A retail_target_reached', commission.retail_target_reached, true);
    // retail_actual (500) >= target (420) -> full 500 * 20%
    assertClose('A commission_retail', commission.commission_retail, 100);
    assertEqual('A service_target_reached', commission.service_target_reached, true);
    // (4200 - 3395.52) * 30%
    assertClose('A commission_service', commission.commission_service, 241.344);
    assertClose('A total_commission', commission.total_commission, 341.344);

    const [tier] = await dataSource.query(
      `SELECT * FROM employee_performance_tier WHERE employee_id = $1 AND salon_id = $2`,
      [empA, salonA],
    );
    // (4200 - 3395.52) / 3395.52 * 100 ≈ 23.69%
    assertClose('A overperformance_pct', tier.overperformance_pct, 23.69, 0.1);
    assertEqual('A tier_reached', tier.tier_reached, 2);
  }

  console.log('\n=== Scenario B: casual ===');
  {
    const [kpi] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empB, salonA],
    );
    assertNull('B service_target', kpi.service_target);
    // retail_target = 16h * 14 = 224
    assertClose('B retail_target', kpi.retail_target, 224);

    const [commission] = await dataSource.query(
      `SELECT * FROM employee_commissions WHERE employee_id = $1 AND salon_id = $2`,
      [empB, salonA],
    );
    assertNull('B service_target (commission row)', commission.service_target);
    assertNull('B service_target_reached', commission.service_target_reached);
    assertClose('B commission_service', commission.commission_service, 0);
    assertEqual('B retail_target_reached', commission.retail_target_reached, true);
    // 300 * 20%
    assertClose('B commission_retail', commission.commission_retail, 60);

    const tierRows = await dataSource.query(
      `SELECT * FROM employee_performance_tier WHERE employee_id = $1 AND salon_id = $2`,
      [empB, salonA],
    );
    assertEqual('B no performance tier row', tierRows.length, 0);
  }

  console.log('\n=== Scenario C: freelancer ===');
  {
    const [kpi] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empC, salonA],
    );
    assertNull('C service_target', kpi.service_target);
    assertNull('C retail_target', kpi.retail_target);

    const [commission] = await dataSource.query(
      `SELECT * FROM employee_commissions WHERE employee_id = $1 AND salon_id = $2`,
      [empC, salonA],
    );
    assertNull('C service_target_reached', commission.service_target_reached);
    assertNull('C retail_target_reached', commission.retail_target_reached);
    // flat 40% of 5000, no threshold
    assertClose('C commission_service', commission.commission_service, 2000);
    // flat 20% of 800, no threshold
    assertClose('C commission_retail', commission.commission_retail, 160);
    assertClose('C total_commission', commission.total_commission, 2160);
  }

  console.log('\n=== Scenario D: contracted, hours deviation ===');
  {
    const [flag] = await dataSource.query(`SELECT * FROM flagged_weeks WHERE employee_id = $1`, [empD]);
    if (!flag) throw new Error('FAIL D: expected a flagged_weeks row, found none');
    assertClose('D contracted_hours', flag.contracted_hours, 38);
    assertClose('D scheduled_hours', flag.scheduled_hours, 32);
    assertEqual('D status', flag.status, 'pending');
  }

  console.log('\n=== Scenario E: contracted, primary + secondary salon ===');
  {
    const [kpiPrimary] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empE, salonA],
    );
    // primary, master rate: 24h * 32.00 = 768; service_target = 768*1.2*3 = 2764.8
    assertClose('E primary service_target', kpiPrimary.service_target, 2764.8);
    assertClose('E primary retail_target', kpiPrimary.retail_target, 336);

    const [kpiSecondary] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empE, salonB],
    );
    // secondary, casual rate: 5h * 36.81 = 184.05; service_target = 184.05*1.2*3 = 662.58
    assertClose('E secondary service_target (casual rate)', kpiSecondary.service_target, 662.58);
    assertClose('E secondary retail_target', kpiSecondary.retail_target, 70);

    const flagRows = await dataSource.query(`SELECT * FROM flagged_weeks WHERE employee_id = $1`, [empE]);
    assertEqual('E no flag (24h primary + 5h secondary = 29h contract)', flagRows.length, 0);
  }

  console.log('\n=== Scenario F: mixed paid/unpaid roster_type blocks ===');
  {
    const [kpi] = await dataSource.query(
      `SELECT * FROM kpi_targets WHERE employee_id = $1 AND salon_id = $2`,
      [empF, salonA],
    );
    // paid hours only: 8h (Wed) + 6h (Thu) = 14h weekday, advanced_senior rate 30.50
    // weighted_wage = 14 * 30.50 = 427; service_target = 427 * 1.2 * 3 = 1537.2
    assertClose('F service_target (unpaid hours excluded)', kpi.service_target, 1537.2);
    // retail_target = 14h * 14 = 196 (unpaid hours excluded here too)
    assertClose('F retail_target (unpaid hours excluded)', kpi.retail_target, 196);

    const dailyRows: { date: string; hours_scheduled: string }[] = await dataSource.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, hours_scheduled FROM daily_targets
       WHERE employee_id = $1 AND salon_id = $2 ORDER BY date`,
      [empF, salonA],
    );
    assertEqual('F daily_targets row count (Fri fully unpaid -> no row)', dailyRows.length, 2);
    const wed = dailyRows.find((r) => r.date === '2026-08-05');
    const thu = dailyRows.find((r) => r.date === '2026-08-06');
    assertClose('F Wed hours (Rostered ON 4h + Training 4h summed)', wed?.hours_scheduled, 8);
    assertClose('F Thu hours (Home Office 3h excluded)', thu?.hours_scheduled, 6);

    const flagRows = await dataSource.query(`SELECT * FROM flagged_weeks WHERE employee_id = $1`, [empF]);
    assertEqual('F no flag (14h paid matches 14h contract, unpaid Fri correctly excluded)', flagRows.length, 0);
  }

  console.log('\nAll calc engine integration checks passed.');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
