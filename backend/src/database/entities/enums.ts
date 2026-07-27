// Shared enum types, used by both the TypeORM entities and the initial migration.
// Keeping them in one place avoids the entity and the raw SQL drifting apart.

export enum EmployeeRole {
  STYLIST = 'stylist',
  MANAGER = 'manager',
  HQ = 'hq',
}

// §4.3 — replaces the old pay_type (fixed_salary | hourly_variable). Drives
// how a weekly service target/commission is computed (§6.8):
//  - contracted: hourly via rate_card, has a service target (§6.1) and 30%
//    marginal commission above it
//  - casual: hourly via rate_card (flat casual rate), no service target/commission
//  - freelancer: no hourly rate at all, flat 40% commission on all service sales
export enum EmploymentType {
  CONTRACTED = 'contracted',
  CASUAL = 'casual',
  FREELANCER = 'freelancer',
}

export enum EmployeeLevel {
  EMERGING_STYLIST = 'emerging_stylist',
  SENIOR_STYLIST = 'senior_stylist',
  ADVANCED_SENIOR_STYLIST = 'advanced_senior_stylist',
  MASTER_STYLIST = 'master_stylist',
  HEAD_STYLIST = 'head_stylist',
}

// §5 rate_card.level — deliberately NOT the same enum as EmployeeLevel: it's
// a rate lookup key, not a professional level. It covers the 4 non-head
// contracted levels plus a separate "casual" bucket (the flat casual rate
// paid regardless of the casual worker's actual professional level, and also
// the rate owed for extra hours worked in a non-primary salon — §6.10). There
// is deliberately no head_stylist entry (freelancer, no hourly rate at all).
export enum RateTier {
  EMERGING_STYLIST = 'emerging_stylist',
  SENIOR_STYLIST = 'senior_stylist',
  ADVANCED_SENIOR_STYLIST = 'advanced_senior_stylist',
  MASTER_STYLIST = 'master_stylist',
  CASUAL = 'casual',
}

// §4.3 adds public_holiday alongside the existing weekday/saturday/sunday.
export enum DayType {
  WEEKDAY = 'weekday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
  PUBLIC_HOLIDAY = 'public_holiday',
}

export enum PaySource {
  PAY_TEMPLATE = 'pay_template',
  TIMESHEET = 'timesheet',
}

export enum NotificationTrigger {
  PROXIMITY_TO_TARGET = 'proximity_to_target',
  MILESTONE_CROSSED = 'milestone_crossed',
  WEEKLY_RECAP = 'weekly_recap',
}

export enum FlaggedWeekStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
}
