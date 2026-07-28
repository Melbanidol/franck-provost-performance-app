import { MigrationInterface, QueryRunner } from 'typeorm';

// Initial schema for the Franck Provost performance app — implements every
// table in spec §5 "Modèle de données" (as revised by the Career & Benefits
// 2026 update: §4.3 employment_type/rate_card/public_holiday, §6.10 revised
// multi-salon wage split), plus employee_level_history, flagged_weeks, and a
// handful of employee columns needed for auth/onboarding/contracted-hours
// deviation flagging (documented in the entities and in the PR/summary).
//
// This branch has not been deployed anywhere yet, so this migration is
// edited in place for schema revisions rather than layered under additional
// migrations — there is no live schema to preserve.
export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // --- Enums -------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "employee_role_enum" AS ENUM ('stylist', 'manager', 'hq')`,
    );
    // §4.3 — replaces the old pay_type_enum (fixed_salary | hourly_variable).
    await queryRunner.query(
      `CREATE TYPE "employment_type_enum" AS ENUM ('contracted', 'casual', 'freelancer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "employee_level_enum" AS ENUM ('emerging_stylist', 'senior_stylist', 'advanced_senior_stylist', 'master_stylist', 'head_stylist')`,
    );
    // rate_card's rate lookup key — 4 contracted levels + casual. Deliberately
    // distinct from employee_level_enum (see rate-card.entity.ts).
    await queryRunner.query(
      `CREATE TYPE "rate_tier_enum" AS ENUM ('emerging_stylist', 'senior_stylist', 'advanced_senior_stylist', 'master_stylist', 'casual')`,
    );
    // §4.3 adds public_holiday.
    await queryRunner.query(
      `CREATE TYPE "day_type_enum" AS ENUM ('weekday', 'saturday', 'sunday', 'public_holiday')`,
    );
    await queryRunner.query(`CREATE TYPE "pay_source_enum" AS ENUM ('pay_template', 'timesheet')`);
    await queryRunner.query(
      `CREATE TYPE "notification_trigger_enum" AS ENUM ('proximity_to_target', 'milestone_crossed', 'weekly_recap')`,
    );
    await queryRunner.query(
      `CREATE TYPE "flagged_week_status_enum" AS ENUM ('pending', 'reviewed')`,
    );

    // --- Core: salons / employees -------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "salons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "timezone" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "simple_salon_id" varchar(128),
        "xero_employee_id" varchar(128),
        "first_name" varchar(128) NOT NULL,
        "last_name" varchar(128) NOT NULL,
        "email" varchar(255),
        "phone" varchar(32),
        "pin_hash" varchar(255),
        "role" employee_role_enum NOT NULL DEFAULT 'stylist',
        "employment_type" employment_type_enum NOT NULL,
        "level" employee_level_enum NOT NULL,
        "contracted_hours_per_week" numeric(5,2),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_employees_head_stylist_is_freelancer" CHECK (
          ("level" = 'head_stylist' AND "employment_type" = 'freelancer')
          OR ("level" <> 'head_stylist' AND "employment_type" <> 'freelancer')
        ),
        CONSTRAINT "chk_employees_contracted_hours_only_for_contracted" CHECK (
          "employment_type" = 'contracted' OR "contracted_hours_per_week" IS NULL
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_employees_simple_salon_id" ON "employees" ("simple_salon_id") WHERE "simple_salon_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_employees_xero_employee_id" ON "employees" ("xero_employee_id") WHERE "xero_employee_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "employee_salon_assignments" (
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_primary" boolean NOT NULL DEFAULT false,
        "first_seen_roster_date" date NOT NULL,
        "last_seen_roster_date" date NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("employee_id", "salon_id")
      )
    `);
    // At most one primary salon per employee (§6.10 revised) — zero is valid
    // right after auto-onboarding, before a primary salon is confirmed.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_employee_salon_assignments_one_primary" ON "employee_salon_assignments" ("employee_id") WHERE "is_primary" = true`,
    );

    // §4.3/§5 — official Career & Benefits 2026 pay grid, replaces employee_rates.
    await queryRunner.query(`
      CREATE TABLE "rate_card" (
        "level" rate_tier_enum NOT NULL,
        "day_type" day_type_enum NOT NULL,
        "rate" numeric(10,2) NOT NULL,
        PRIMARY KEY ("level", "day_type")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_level_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "level" employee_level_enum NOT NULL,
        "effective_from" date NOT NULL,
        "effective_to" date,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_employee_level_history_employee_from" ON "employee_level_history" ("employee_id", "effective_from")`,
    );

    await queryRunner.query(`
      CREATE TABLE "level_targets" (
        "level" employee_level_enum PRIMARY KEY,
        "avg_spend_target" numeric(10,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // --- Payroll / roster inputs --------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "employee_pay" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "week_start" date NOT NULL,
        "gross_wage" numeric(12,2) NOT NULL,
        "source" pay_source_enum NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "week_start")
      )
    `);

    // Simple Salon's own "Roster Types" admin config (Rostered ON, Sick,
    // Public Holiday, Training, Franchisees Meeting, ...) — one flag drives
    // everything downstream: is_paid = true counts toward the wage-based
    // service_target, the retail_target, and the contracted-hours quota
    // check alike (confirmed simple on purpose).
    await queryRunner.query(`
      CREATE TABLE "roster_types" (
        "name" varchar(64) PRIMARY KEY,
        "is_paid" boolean NOT NULL
      )
    `);

    // One row per roster BLOCK, not per day — a day can mix roster_types
    // (e.g. half-day Annual Leave + half-day Rostered ON), so the unique key
    // includes roster_type rather than being one row per date.
    await queryRunner.query(`
      CREATE TABLE "roster_hours" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "roster_type" varchar(64) NOT NULL REFERENCES "roster_types"("name"),
        "day_type" day_type_enum NOT NULL,
        "hours_scheduled" numeric(5,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "date", "roster_type")
      )
    `);

    // --- Calculated targets / commissions -----------------------------------
    // service_target/retail_target nullable — §4.3 makes them conditional on
    // employment_type (casual: no service_target; freelancer: neither).
    await queryRunner.query(`
      CREATE TABLE "kpi_targets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "week_start" date NOT NULL,
        "service_target" numeric(12,2),
        "retail_target" numeric(12,2),
        "rebooking_target" numeric(5,2) NOT NULL,
        "avg_spend_target" numeric(10,2) NOT NULL,
        "treatment_conversion_target" numeric(5,2) NOT NULL,
        "retail_conversion_target" numeric(5,2) NOT NULL,
        "calculated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "week_start")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "daily_targets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "day_type" day_type_enum NOT NULL,
        "hours_scheduled" numeric(5,2) NOT NULL,
        "weighted_hours" numeric(10,4) NOT NULL,
        "daily_service_target" numeric(12,2),
        "daily_retail_target" numeric(12,2),
        "week_start" date NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "date")
      )
    `);

    // retail_target/retail_target_reached/service_target/service_target_reached
    // nullable for the same §4.3 reasons as kpi_targets. *_actual and
    // commission_* stay NOT NULL: actuals always exist, and $0 commission is
    // a real computed value (not an absence of a target).
    await queryRunner.query(`
      CREATE TABLE "employee_commissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "week_start" date NOT NULL,
        "retail_actual" numeric(12,2) NOT NULL,
        "retail_target" numeric(12,2),
        "retail_target_reached" boolean,
        "commission_retail" numeric(12,2) NOT NULL,
        "service_actual" numeric(12,2) NOT NULL,
        "service_target" numeric(12,2),
        "service_target_reached" boolean,
        "commission_service" numeric(12,2) NOT NULL,
        "total_commission" numeric(12,2) NOT NULL,
        "calculated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "week_start")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "formula_settings" (
        "key" varchar(128) PRIMARY KEY,
        "value" numeric(12,4) NOT NULL,
        "updated_by" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // --- Performance actuals (from Simple Salon POS) ------------------------
    await queryRunner.query(`
      CREATE TABLE "daily_performance" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "service_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "retail_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "clients_served" integer NOT NULL DEFAULT 0,
        "treatments_count" integer NOT NULL DEFAULT 0,
        "products_sold" integer NOT NULL DEFAULT 0,
        "rebooking_rate" numeric(5,2),
        "avg_spend_per_client" numeric(10,2),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "date")
      )
    `);

    // --- Gamification --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "achievements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "icon" varchar(255) NOT NULL,
        "unlock_condition" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_achievements" (
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "achievement_id" uuid NOT NULL REFERENCES "achievements"("id") ON DELETE CASCADE,
        "unlocked_at" timestamptz NOT NULL,
        PRIMARY KEY ("employee_id", "achievement_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "streaks" (
        "employee_id" uuid PRIMARY KEY REFERENCES "employees"("id") ON DELETE CASCADE,
        "current_streak" integer NOT NULL DEFAULT 0,
        "longest_streak" integer NOT NULL DEFAULT 0,
        "last_active_date" date,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "performance_tiers" (
        "tier_number" integer PRIMARY KEY,
        "threshold_pct" numeric(5,2) NOT NULL,
        "bonus_description" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_performance_tier" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
        "week_start" date NOT NULL,
        "overperformance_pct" numeric(6,2) NOT NULL,
        "tier_reached" integer REFERENCES "performance_tiers"("tier_number") ON DELETE SET NULL,
        "calculated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "salon_id", "week_start")
      )
    `);

    // --- Notifications ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "notification_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trigger_type" notification_trigger_enum NOT NULL,
        "threshold_pct" numeric(5,2),
        "message_template" text NOT NULL,
        "signature" varchar(64) NOT NULL DEFAULT 'Mel',
        "active" boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "template_id" uuid NOT NULL REFERENCES "notification_templates"("id") ON DELETE CASCADE,
        "sent_at" timestamptz NOT NULL
      )
    `);

    // --- Contracted-hours deviation flags (§6.3, addition beyond §5) --------
    // No salon_id: the contract is at the employee level, so scheduled_hours
    // is the sum across every salon worked that week (§6.10 multi-salon).
    await queryRunner.query(`
      CREATE TABLE "flagged_weeks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "week_start" date NOT NULL,
        "contracted_hours" numeric(5,2) NOT NULL,
        "scheduled_hours" numeric(5,2) NOT NULL,
        "status" flagged_week_status_enum NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("employee_id", "week_start")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "flagged_weeks"`);
    await queryRunner.query(`DROP TABLE "notification_log"`);
    await queryRunner.query(`DROP TABLE "notification_templates"`);
    await queryRunner.query(`DROP TABLE "employee_performance_tier"`);
    await queryRunner.query(`DROP TABLE "performance_tiers"`);
    await queryRunner.query(`DROP TABLE "streaks"`);
    await queryRunner.query(`DROP TABLE "employee_achievements"`);
    await queryRunner.query(`DROP TABLE "achievements"`);
    await queryRunner.query(`DROP TABLE "daily_performance"`);
    await queryRunner.query(`DROP TABLE "formula_settings"`);
    await queryRunner.query(`DROP TABLE "employee_commissions"`);
    await queryRunner.query(`DROP TABLE "daily_targets"`);
    await queryRunner.query(`DROP TABLE "kpi_targets"`);
    await queryRunner.query(`DROP TABLE "roster_hours"`);
    await queryRunner.query(`DROP TABLE "roster_types"`);
    await queryRunner.query(`DROP TABLE "employee_pay"`);
    await queryRunner.query(`DROP TABLE "level_targets"`);
    await queryRunner.query(`DROP TABLE "employee_level_history"`);
    await queryRunner.query(`DROP TABLE "rate_card"`);
    await queryRunner.query(`DROP TABLE "employee_salon_assignments"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TABLE "salons"`);

    await queryRunner.query(`DROP TYPE "flagged_week_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_trigger_enum"`);
    await queryRunner.query(`DROP TYPE "pay_source_enum"`);
    await queryRunner.query(`DROP TYPE "day_type_enum"`);
    await queryRunner.query(`DROP TYPE "rate_tier_enum"`);
    await queryRunner.query(`DROP TYPE "employee_level_enum"`);
    await queryRunner.query(`DROP TYPE "employment_type_enum"`);
    await queryRunner.query(`DROP TYPE "employee_role_enum"`);
  }
}
