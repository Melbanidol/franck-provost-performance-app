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

interface NormalizedRosterEntry {
  simpleSalonEmployeeId: string;
  date: string; // YYYY-MM-DD
  rosterTypeName: string;
  hours: number;
}

export interface RosterSyncResult {
  entriesReceived: number;
  written: number;
  unmatchedEmployees: string[]; // simple_salon_id values with no local employee
  unmappedRosterTypes: string[]; // Simple Salon roster type names not in our 23
  unparsable: number; // raw entries that didn't even have the fields we look for
}

const STALE_ASSIGNMENT_DAYS = 30;

// §4.1 — pulls roster blocks from Simple Salon into roster_hours, and keeps
// employee_salon_assignments current (is_active / first_seen / last_seen).
//
// Deliberately does NOT auto-create Employee rows for an unmatched
// simple_salon_id, even though the schema comment on employees.simple_salon_id
// anticipates that eventually happening ("nullable until the first roster
// sync creates the employee"). employment_type and level are NOT NULL with a
// CHECK constraint tying level='head_stylist' to employment_type='freelancer'
// — there's no way to infer either safely from a roster feed alone, and
// guessing would silently corrupt wage/target calculations for that person.
// Unmatched entries are surfaced in the sync result instead, for a manager
// to link manually (or for a future onboarding flow to prompt for the
// missing fields). This mirrors the same conservative choice already made
// for the Xero Payroll integration (see xero-payroll.service.ts).
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
    dateFrom: string;
    dateTo: string;
  }): Promise<RosterSyncResult> {
    const { companyId, salonId, dateFrom, dateTo } = params;

    // Body param names (date_from/date_to vs dateFrom/dateTo etc.) are still
    // unconfirmed — see file header in simple-salon-api.client.ts. Sending
    // both common conventions costs nothing and the API should just ignore
    // whichever one it doesn't recognise.
    const raw = await this.apiClient.post(companyId, this.apiClient.rosterPath, {
      date_from: dateFrom,
      date_to: dateTo,
      dateFrom,
      dateTo,
    });
    const rawEntries = this.unwrapEntries(raw);

    const normalized: NormalizedRosterEntry[] = [];
    let unparsable = 0;
    for (const entry of rawEntries) {
      const mapped = this.mapRosterEntry(entry);
      if (mapped) normalized.push(mapped);
      else unparsable++;
    }
    if (unparsable > 0) {
      this.logger.warn(
        `${unparsable}/${rawEntries.length} Simple Salon roster entries didn't match any of the guessed field names — see mapRosterEntry() in this file and GET /simple-salon/raw to inspect the real shape.`,
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
      const employee = employeesBySimpleSalonId.get(entry.simpleSalonEmployeeId);
      if (!employee) {
        unmatchedEmployees.add(entry.simpleSalonEmployeeId);
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
      entriesReceived: rawEntries.length,
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

  // Unwraps whatever envelope Simple Salon puts the array in. Real shape
  // unverified — see file header note in simple-salon-api.client.ts. Tries
  // the response itself first (already an array), then the most likely
  // wrapper key names.
  private unwrapEntries(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      for (const key of ['data', 'Data', 'Roster', 'Rosters', 'results', 'Results', 'items', 'Items']) {
        const value = (raw as Record<string, unknown>)[key];
        if (Array.isArray(value)) return value;
      }
    }
    this.logger.warn('Could not find an array of roster entries in the Simple Salon response — got: ' + JSON.stringify(raw).slice(0, 500));
    return [];
  }

  // Best-guess field names — see file header note in simple-salon-api.client.ts.
  // Returns null (rather than throwing) for anything that doesn't have at
  // least an employee id, a date, a roster type, and hours under one of the
  // guessed names, so one malformed entry doesn't abort the whole sync.
  private mapRosterEntry(entry: unknown): NormalizedRosterEntry | null {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;

    const employeeId = this.firstString(e, ['EmployeeID', 'EmployeeId', 'StaffID', 'StaffId', 'OperatorID']);
    const date = this.firstString(e, ['Date', 'RosterDate', 'ShiftDate']);
    const rosterTypeName = this.firstString(e, ['RosterType', 'ShiftType', 'Type', 'RosterTypeName']);
    const hours = this.firstNumber(e, ['Hours', 'HoursScheduled', 'Duration', 'ScheduledHours']);

    if (!employeeId || !date || !rosterTypeName || hours === null) return null;
    return { simpleSalonEmployeeId: employeeId, date: date.slice(0, 10), rosterTypeName, hours };
  }

  private firstString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    return null;
  }

  private firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    }
    return null;
  }
}
