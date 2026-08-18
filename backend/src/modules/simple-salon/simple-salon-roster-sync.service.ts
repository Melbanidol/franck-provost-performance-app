import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Employee,
  EmployeeSalonAssignment,
  RosterHour,
  RosterType,
} from '../../database/entities';
import { DayType } from '../../database/entities/enums';
import { SimpleSalonApiClient } from './simple-salon-api.client';

// Real shape, confirmed against api.simplesalon.com/docs/v1 (Rosters >
// Models). duration is in minutes; time_start/time_end are full ISO
// datetimes (not separate date+hours). roster_type may or may not be
// embedded depending on whether the expanded_fields request option is
// honoured — see fetchRosterTypeNamesById() below, which resolves the name
// independently either way.
interface SimpleSalonRoster {
  roster_id: number;
  company_id: number;
  operator_id: number;
  duration: number;
  time_start: string;
  time_end: string;
  roster_type_id: number;
  roster_type?: { roster_type_id: number; name: string };
}

interface SimpleSalonRosterType {
  roster_type_id: number;
  name: string;
}

interface NormalizedRosterEntry {
  simpleSalonOperatorId: string;
  date: string; // YYYY-MM-DD, derived from time_start
  rosterTypeName: string;
  hours: number; // duration minutes / 60
}

export interface RosterSyncResult {
  entriesReceived: number;
  written: number;
  unmatchedEmployees: string[]; // operator_id values with no local employee
  unmappedRosterTypes: string[]; // Simple Salon roster type names not in our 23
  unparsable: number; // raw entries missing a resolvable roster_type name
}

const STALE_ASSIGNMENT_DAYS = 30;

// §4.1 — pulls roster blocks from Simple Salon into roster_hours, and keeps
// employee_salon_assignments current (is_active / first_seen / last_seen).
//
// Deliberately does NOT auto-create Employee rows for an unmatched
// operator_id, even though the schema comment on employees.simple_salon_id
// anticipates that eventually happening ("nullable until the first roster
// sync creates the employee"). employment_type and level are NOT NULL with a
// CHECK constraint tying level='head_stylist' to employment_type='freelancer'
// — there's no way to infer either safely from a roster feed alone, and
// guessing would silently corrupt wage/target calculations for that person.
// Unmatched entries are surfaced in the sync result instead, for a manager
// to link manually. Mirrors the same conservative choice already made for
// the Xero Payroll integration (see xero-payroll.service.ts).
@Injectable()
export class SimpleSalonRosterSyncService {
  private readonly logger = new Logger(SimpleSalonRosterSyncService.name);

  constructor(
    private readonly apiClient: SimpleSalonApiClient,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(RosterHour) private readonly rosterHourRepo: Repository<RosterHour>,
    @InjectRepository(RosterType) private readonly rosterTypeRepo: Repository<RosterType>,
    @InjectRepository(EmployeeSalonAssignment)
    private readonly assignmentRepo: Repository<EmployeeSalonAssignment>,
  ) {}

  async syncRosterForSalon(params: {
    companyId: string;
    salonId: string;
    dateFrom: string; // YYYY-MM-DD, inclusive
    dateTo: string; // YYYY-MM-DD, exclusive per Simple Salon's time_end semantics
  }): Promise<RosterSyncResult> {
    const { companyId, salonId, dateFrom, dateTo } = params;

    // POST /v1/roster/list — confirmed shape (docs: Rosters > List).
    // exclude_dome + company_id scope strictly to this one company even when
    // logged in via a Dome account. rows_per_page: -1 returns everything for
    // a single-week-or-less range without pagination (per docs).
    const raw = await this.apiClient.post<{ rosters: SimpleSalonRoster[] }>(companyId, '/v1/roster/list', {
      filters: {
        time_start: `${dateFrom}T00:00:00+00:00`,
        time_end: `${dateTo}T00:00:00+00:00`,
        company_id: Number(companyId),
        exclude_dome: true,
      },
      options: {
        rows_per_page: -1,
        expanded_fields: ['roster_type'],
      },
    });
    const rawRosters = raw.rosters ?? [];

    const rosterTypeNamesById = await this.fetchRosterTypeNamesById(companyId);

    const normalized: NormalizedRosterEntry[] = [];
    let unparsable = 0;
    for (const roster of rawRosters) {
      const rosterTypeName = roster.roster_type?.name ?? rosterTypeNamesById.get(roster.roster_type_id);
      if (!rosterTypeName || !roster.time_start || !roster.operator_id) {
        unparsable++;
        continue;
      }
      normalized.push({
        simpleSalonOperatorId: String(roster.operator_id),
        date: roster.time_start.slice(0, 10),
        rosterTypeName,
        hours: roster.duration / 60,
      });
    }
    if (unparsable > 0) {
      this.logger.warn(
        `${unparsable}/${rawRosters.length} Simple Salon rosters had no resolvable roster_type name or missing operator_id/time_start.`,
      );
    }

    const employeesBySimpleSalonId = new Map(
      (await this.employeeRepo.find({ where: {} }))
        .filter((e) => e.simpleSalonId)
        .map((e) => [e.simpleSalonId as string, e]),
    );
    const validRosterTypeNames = new Set((await this.rosterTypeRepo.find()).map((rt) => rt.name));

    const unmatchedEmployees = new Set<string>();
    const unmappedRosterTypes = new Set<string>();
    const dateRangeByEmployee = new Map<string, { min: string; max: string }>();
    let written = 0;

    for (const entry of normalized) {
      const employee = employeesBySimpleSalonId.get(entry.simpleSalonOperatorId);
      if (!employee) {
        unmatchedEmployees.add(entry.simpleSalonOperatorId);
        continue;
      }
      if (!validRosterTypeNames.has(entry.rosterTypeName)) {
        unmappedRosterTypes.add(entry.rosterTypeName);
        continue;
      }

      const dayType = this.resolveDayType(entry.date, entry.rosterTypeName);

      await this.rosterHourRepo.upsert(
        {
          employeeId: employee.id,
          salonId,
          date: entry.date,
          rosterType: entry.rosterTypeName,
          dayType,
          hoursScheduled: entry.hours.toFixed(2),
        },
        ['employeeId', 'salonId', 'date', 'rosterType'],
      );
      written++;

      const range = dateRangeByEmployee.get(employee.id);
      if (!range) {
        dateRangeByEmployee.set(employee.id, { min: entry.date, max: entry.date });
      } else {
        if (entry.date < range.min) range.min = entry.date;
        if (entry.date > range.max) range.max = entry.date;
      }
    }

    await this.updateAssignments(salonId, dateRangeByEmployee);

    return {
      entriesReceived: rawRosters.length,
      written,
      unmatchedEmployees: [...unmatchedEmployees],
      unmappedRosterTypes: [...unmappedRosterTypes],
      unparsable,
    };
  }

  // §5 employee_salon_assignments — after 1 rolling month with no roster in
  // a salon, that assignment is deactivated. Call this after a sync (or on
  // a schedule) to keep is_active current beyond just the salons touched by
  // the latest sync.
  async deactivateStaleAssignments(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_ASSIGNMENT_DAYS * 86_400_000).toISOString().slice(0, 10);
    const result = await this.assignmentRepo
      .createQueryBuilder()
      .update(EmployeeSalonAssignment)
      .set({ isActive: false })
      .where('is_active = true')
      .andWhere('last_seen_roster_date < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  private async updateAssignments(
    salonId: string,
    dateRangeByEmployee: Map<string, { min: string; max: string }>,
  ): Promise<void> {
    for (const [employeeId, range] of dateRangeByEmployee) {
      const existing = await this.assignmentRepo.findOne({ where: { employeeId, salonId } });
      const firstSeen = existing && existing.firstSeenRosterDate < range.min ? existing.firstSeenRosterDate : range.min;
      const lastSeen = existing && existing.lastSeenRosterDate > range.max ? existing.lastSeenRosterDate : range.max;

      await this.assignmentRepo.upsert(
        {
          employeeId,
          salonId,
          isActive: true,
          isPrimary: existing?.isPrimary ?? false,
          firstSeenRosterDate: firstSeen,
          lastSeenRosterDate: lastSeen,
        },
        ['employeeId', 'salonId'],
      );
    }
  }

  // Fallback name resolution for when a roster entry only carries
  // roster_type_id (i.e. expanded_fields wasn't honoured). One extra call
  // per sync, not per roster — POST /v1/roster_type/list, confirmed shape
  // (docs: Roster Types > Models).
  private async fetchRosterTypeNamesById(companyId: string): Promise<Map<number, string>> {
    const raw = await this.apiClient.post<{ roster_types: SimpleSalonRosterType[] }>(
      companyId,
      '/v1/roster_type/list',
      { filters: { company_id: Number(companyId) }, options: { rows_per_page: -1 } },
    );
    return new Map((raw.roster_types ?? []).map((rt) => [rt.roster_type_id, rt.name]));
  }

  // weekday/saturday/sunday from the calendar date, overridden to
  // public_holiday when Simple Salon itself labelled the block "Public
  // Holiday" (one of the 23 seeded roster_types). There's no public-holiday
  // calendar table in this schema yet, so a block worked on an actual public
  // holiday but rostered under a different type (e.g. "Rostered ON") won't
  // be caught — flagged as a follow-up, not attempted here.
  private resolveDayType(date: string, rosterTypeName: string): DayType {
    if (rosterTypeName === 'Public Holiday') return DayType.PUBLIC_HOLIDAY;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
    if (day === 0) return DayType.SUNDAY;
    if (day === 6) return DayType.SATURDAY;
    return DayType.WEEKDAY;
  }
}
