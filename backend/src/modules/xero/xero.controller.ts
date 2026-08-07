import { BadRequestException, Controller, Get, Query, Redirect } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XeroConnection } from '../../database/entities';
import { XeroOauthService } from './xero-oauth.service';
import { XeroPayrollService } from './xero-payroll.service';

@Controller('xero')
export class XeroController {
  constructor(
    private readonly oauth: XeroOauthService,
    private readonly payroll: XeroPayrollService,
    @InjectRepository(XeroConnection)
    private readonly connectionRepo: Repository<XeroConnection>,
  ) {}

  // Step 1 — visit this in a browser (not via curl/fetch: Xero needs an
  // actual user to log in and grant consent). Redirects to Xero's consent
  // screen.
  @Get('connect')
  @Redirect()
  connect(): { url: string } {
    const { url } = this.oauth.buildAuthorizeUrl();
    return { url };
  }

  // Step 2 (the actual callback) lives in xero-callback.controller.ts, at
  // the unprefixed route /callback — matching XERO_REDIRECT_URI exactly.

  // Diagnostic — confirms a connection is on file without needing DB access.
  @Get('status')
  async status(): Promise<{
    connected: boolean;
    tenants: Array<{ tenantId: string; tenantName: string | null; expiresAt: Date }>;
  }> {
    const connections = await this.connectionRepo.find({ where: {} });
    return {
      connected: connections.length > 0,
      tenants: connections.map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        expiresAt: c.expiresAt,
      })),
    };
  }

  @Get('payroll/employees')
  async employees(): Promise<unknown[]> {
    return this.payroll.fetchEmployees();
  }

  // The test endpoint requested: fetches gross_wage for every payslip
  // overlapping the given week. Returns both the mapped value and the raw
  // Xero payslip so the field mapping (see xero-payroll.service.ts) can be
  // eyeballed against real data on the first run.
  @Get('payroll/gross-wage')
  async grossWage(@Query('weekStart') weekStart: string) {
    if (!weekStart) {
      throw new BadRequestException('weekStart query param is required, e.g. ?weekStart=2026-08-03');
    }
    const results = await this.payroll.fetchGrossWagesForWeek(weekStart);
    const unmatched = results.filter((r) => r.matchedLocalEmployeeId === null);
    return {
      weekStart,
      count: results.length,
      unmatchedCount: unmatched.length,
      unmatchedNote:
        unmatched.length > 0
          ? 'These Xero employees have no matching employees.xero_employee_id locally yet — expected until employees are linked.'
          : undefined,
      results,
    };
  }
}
