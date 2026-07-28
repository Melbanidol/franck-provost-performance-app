import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RosterHour } from '../../../database/entities';
import { DayType } from '../../../database/entities/enums';
import { weekDates } from '../util/date';

export interface RosterDay {
  date: string;
  dayType: DayType;
  hoursScheduled: number;
}

// Reads roster_hours as published in Simple Salon (§4.1) — the single
// source of truth for what's actually scheduled. Deliberately no "week A /
// week B" pattern logic: whatever is currently rostered for the 7 days of
// the week is what gets used (§6.2).
//
// Only PAID roster_types (roster_types.is_paid) feed the calc engine at
// all: paid hours drive the wage-based service_target, the retail_target,
// and the contracted-hours quota check alike (confirmed — one flag, not a
// separate "counts as working time" dimension). Unpaid blocks (Lunch, Home
// Office, Unpaid Leave, ...) stay in roster_hours for a full record of what
// Simple Salon reported, but never reach the domain layer.
@Injectable()
export class RosterWeekService {
  constructor(
    @InjectRepository(RosterHour) private readonly rosterRepo: Repository<RosterHour>,
  ) {}

  // Every PAID roster_hours block for this employee, across every salon,
  // for the 7 days of the given week. A single day/salon can have several
  // blocks (e.g. half-day Annual Leave + half-day Rostered ON) — grouping
  // and summing happens in groupBySalon.
  async loadWeek(employeeId: string, weekStart: string): Promise<RosterHour[]> {
    const dates = weekDates(weekStart);
    return this.rosterRepo
      .createQueryBuilder('r')
      .innerJoin('roster_types', 'rt', 'rt.name = r.roster_type')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.date IN (:...dates)', { dates })
      .andWhere('rt.is_paid = true')
      .getMany();
  }

  // Sums same-date blocks into one RosterDay per (salon, date) — day_type is
  // assumed consistent across blocks of the same calendar date/salon (it
  // describes the date, not the activity), so the first block's value is
  // used.
  groupBySalon(rows: RosterHour[]): Map<string, RosterDay[]> {
    const bySalon = new Map<string, Map<string, RosterDay>>();
    for (const row of rows) {
      const byDate = bySalon.get(row.salonId) ?? new Map<string, RosterDay>();
      const hours = parseFloat(row.hoursScheduled);
      const existing = byDate.get(row.date);
      if (existing) {
        existing.hoursScheduled += hours;
      } else {
        byDate.set(row.date, { date: row.date, dayType: row.dayType, hoursScheduled: hours });
      }
      bySalon.set(row.salonId, byDate);
    }

    const result = new Map<string, RosterDay[]>();
    for (const [salonId, byDate] of bySalon) {
      result.set(salonId, Array.from(byDate.values()));
    }
    return result;
  }

  // Total paid hours across ALL salons — used for the flagged_weeks
  // deviation check (§6.3), which compares against a single per-employee
  // contract, not a per-salon figure (§6.10).
  totalHours(rows: RosterHour[]): number {
    return rows.reduce((sum, r) => sum + parseFloat(r.hoursScheduled), 0);
  }
}
