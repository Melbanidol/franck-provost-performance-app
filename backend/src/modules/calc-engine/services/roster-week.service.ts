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
@Injectable()
export class RosterWeekService {
  constructor(
    @InjectRepository(RosterHour) private readonly rosterRepo: Repository<RosterHour>,
  ) {}

  // Every roster_hours row for this employee, across every salon, for the
  // 7 days of the given week.
  async loadWeek(employeeId: string, weekStart: string): Promise<RosterHour[]> {
    const dates = weekDates(weekStart);
    return this.rosterRepo
      .createQueryBuilder('r')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.date IN (:...dates)', { dates })
      .getMany();
  }

  groupBySalon(rows: RosterHour[]): Map<string, RosterDay[]> {
    const bySalon = new Map<string, RosterDay[]>();
    for (const row of rows) {
      const list = bySalon.get(row.salonId) ?? [];
      list.push({ date: row.date, dayType: row.dayType, hoursScheduled: parseFloat(row.hoursScheduled) });
      bySalon.set(row.salonId, list);
    }
    return bySalon;
  }

  // Total scheduled hours across ALL salons — used for the flagged_weeks
  // deviation check (§6.3), which compares against a single per-employee
  // contract, not a per-salon figure (§6.10).
  totalHours(rows: RosterHour[]): number {
    return rows.reduce((sum, r) => sum + parseFloat(r.hoursScheduled), 0);
  }
}
