import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../database/entities';
import { XeroOauthService } from './xero-oauth.service';

const PAYROLL_BASE_URL = 'https://api.xero.com/payroll.xro/2.0';

interface XeroPayRunSummary {
  PayRunID: string;
  PayRunPeriodStartDate: string;
  PayRunPeriodEndDate: string;
  PayRunStatus: string;
  Payslips: Array<{ PayslipID: string; EmployeeID: string }>;
}

interface XeroPayslipDetail {
  PayslipID: string;
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  // Xero's Payslip resource carries a top-level "Wages" figure on most AU
  // orgs — this is the field we treat as gross_wage (§4.2). NOT verified
  // against a live response yet (this app has never completed a real OAuth
  // consent). If Wages is absent/zero on the first real payslip returned,
  // fall back to summing Earnings[].Amount and flag it — see mapGrossWage
  // below and the raw payslip returned alongside it in the endpoint response.
  Wages?: number;
  Earnings?: Array<{ EarningsRateID: string; Amount: number }>;
}

export interface GrossWageResult {
  xeroEmployeeId: string;
  firstName: string;
  lastName: string;
  grossWage: number;
  grossWageSource: 'wages_field' | 'summed_earnings';
  matchedLocalEmployeeId: string | null;
  payRunId: string;
  payslipId: string;
  raw: XeroPayslipDetail;
}

// Read-only client for Xero Payroll AU (§4.2 — employee_pay is a read-only
// snapshot pulled from here, never written back to Xero). This service only
// *fetches and maps* data for inspection; it deliberately does not persist
// into employee_pay yet — see the caveat on the Wages field above. Once a
// real response confirms the field mapping, upserting into employee_pay is
// a small follow-up on top of this.
@Injectable()
export class XeroPayrollService {
  private readonly logger = new Logger(XeroPayrollService.name);

  constructor(
    private readonly oauth: XeroOauthService,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async fetchEmployees(): Promise<unknown[]> {
    const { accessToken, tenantId } = await this.oauth.getValidAccessToken();
    return this.get(accessToken, tenantId, '/Employees');
  }

  // Finds the pay run(s) overlapping [weekStart, weekStart+6] and returns
  // the gross wage per employee on those payslips, matched against our
  // local employees.xero_employee_id where possible.
  async fetchGrossWagesForWeek(weekStart: string): Promise<GrossWageResult[]> {
    const { accessToken, tenantId } = await this.oauth.getValidAccessToken();

    const weekStartDate = new Date(`${weekStart}T00:00:00Z`);
    if (Number.isNaN(weekStartDate.getTime())) {
      throw new BadRequestException('weekStart must be an ISO date, e.g. 2026-08-03');
    }
    const weekEndDate = new Date(weekStartDate.getTime() + 6 * 86_400_000);

    const payRuns = await this.findPayRunsOverlapping(accessToken, tenantId, weekStartDate, weekEndDate);
    if (payRuns.length === 0) {
      this.logger.warn(
        `No Xero pay runs found overlapping ${weekStart}..${weekEndDate.toISOString().slice(0, 10)}`,
      );
      return [];
    }

    const localEmployeesByXeroId = new Map(
      (await this.employeeRepo.find({ where: {} })).filter((e) => e.xeroEmployeeId).map((e) => [e.xeroEmployeeId, e.id]),
    );

    const results: GrossWageResult[] = [];
    for (const payRun of payRuns) {
      for (const payslipSummary of payRun.Payslips) {
        const detail = await this.get<{ Payslip: XeroPayslipDetail }>(
          accessToken,
          tenantId,
          `/Payslip/${payslipSummary.PayslipID}`,
        );
        const payslip = detail.Payslip;
        const [grossWage, grossWageSource] = this.mapGrossWage(payslip);

        results.push({
          xeroEmployeeId: payslip.EmployeeID,
          firstName: payslip.FirstName,
          lastName: payslip.LastName,
          grossWage,
          grossWageSource,
          matchedLocalEmployeeId: localEmployeesByXeroId.get(payslip.EmployeeID) ?? null,
          payRunId: payRun.PayRunID,
          payslipId: payslip.PayslipID,
          raw: payslip,
        });
      }
    }
    return results;
  }

  private mapGrossWage(payslip: XeroPayslipDetail): [number, 'wages_field' | 'summed_earnings'] {
    if (typeof payslip.Wages === 'number') {
      return [payslip.Wages, 'wages_field'];
    }
    const summed = (payslip.Earnings ?? []).reduce((sum, e) => sum + (e.Amount ?? 0), 0);
    return [summed, 'summed_earnings'];
  }

  // Pages through /PayRuns (newest first, per Xero's default ordering) and
  // stops once we've passed the target week, so this doesn't walk the
  // org's entire pay run history for old requests. Client-side date
  // filtering instead of an OData `filter` query param — deliberately, to
  // avoid guessing at Xero's exact filter syntax before this has ever run
  // against a real org.
  private async findPayRunsOverlapping(
    accessToken: string,
    tenantId: string,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<XeroPayRunSummary[]> {
    const matches: XeroPayRunSummary[] = [];
    const maxPages = 5;

    for (let page = 1; page <= maxPages; page++) {
      const response = await this.get<{ PayRuns: XeroPayRunSummary[] }>(
        accessToken,
        tenantId,
        `/PayRuns?page=${page}`,
      );
      const payRuns = response.PayRuns ?? [];
      if (payRuns.length === 0) break;

      let allBeforeWindow = true;
      for (const payRun of payRuns) {
        const start = new Date(payRun.PayRunPeriodStartDate);
        const end = new Date(payRun.PayRunPeriodEndDate);
        const overlaps = start <= weekEnd && end >= weekStart;
        if (overlaps) {
          matches.push(payRun);
          allBeforeWindow = false;
        } else if (end >= weekStart) {
          allBeforeWindow = false;
        }
      }
      if (allBeforeWindow) break; // every pay run on this page is older than the window
    }

    return matches;
  }

  private async get<T = unknown>(accessToken: string, tenantId: string, path: string): Promise<T> {
    const response = await fetch(`${PAYROLL_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Xero Payroll API ${path} returned ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
  }
}
