// Shared enum types, used by both the TypeORM entities and the initial migration.
// Keeping them in one place avoids the entity and the raw SQL drifting apart.

export enum EmployeeRole {
  STYLIST = 'stylist',
  MANAGER = 'manager',
  HQ = 'hq',
}

export enum PayType {
  FIXED_SALARY = 'fixed_salary',
  HOURLY_VARIABLE = 'hourly_variable',
}

export enum EmployeeLevel {
  EMERGING_STYLIST = 'emerging_stylist',
  SENIOR_STYLIST = 'senior_stylist',
  ADVANCED_SENIOR_STYLIST = 'advanced_senior_stylist',
  MASTER_STYLIST = 'master_stylist',
  HEAD_STYLIST = 'head_stylist',
}

export enum DayType {
  WEEKDAY = 'weekday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
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
