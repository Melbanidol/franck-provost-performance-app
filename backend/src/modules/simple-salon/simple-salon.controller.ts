import { BadRequestException, Controller, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimpleSalonApiClient } from './simple-salon-api.client';
import { RosterSyncResult, SimpleSalonRosterSyncService } from './simple-salon-roster-sync.service';

@Controller('simple-salon')
export class SimpleSalonController {
  constructor(
    private readonly config: ConfigService,
    private readonly apiClient: SimpleSalonApiClient,
    private readonly syncService: SimpleSalonRosterSyncService,
  ) {}

  // Confirms required env vars are present — no live API call, so this
  // always works even before the endpoint paths are verified.
  @Get('status')
  status(): { configured: boolean; missing: string[]; rosterPath: string } {
    const required = ['SIMPLE_SALON_API_URL', 'SIMPLE_SALON_TOKEN', 'SIMPLE_SALON_SIGN_KEY'];
    const missing = required.filter((key) => !this.config.get<string>(key));
    return { configured: missing.length === 0, missing, rosterPath: this.apiClient.rosterPath };
  }

  // Diagnostic — deliberately kept as a browser-pasteable GET even though
  // Simple Salon's real API is POST/RPC-style throughout: this logs in for
  // the given company, then issues a real POST to `path` with the other
  // query params (minus companyId/path themselves) forwarded as the JSON
  // body, and returns the raw response untouched. Use this to confirm the
  // real roster/appointments endpoint path and field names before trusting
  // anything in simple-salon-roster-sync.service.ts.
  // Example: GET /simple-salon/raw?companyId=40552&path=/v1/roster/list&dateFrom=2026-08-03&dateTo=2026-08-09
  @Get('raw')
  async raw(
    @Query('companyId') companyId: string,
    @Query('path') path: string,
    @Query() allQuery: Record<string, string>,
  ) {
    if (!companyId) throw new BadRequestException('companyId query param is required');
    if (!path) throw new BadRequestException('path query param is required, e.g. /v1/roster/list');
    const { companyId: _c, path: _p, ...body } = allQuery;
    return this.apiClient.rawPost(companyId, path, body);
  }

  // Real sync — only writes roster_hours for employees already matched
  // locally by simple_salon_id (see the class comment in
  // simple-salon-roster-sync.service.ts for why unmatched employees aren't
  // auto-created). Returns a summary rather than the full written rows.
  @Post('roster/sync')
  async syncRoster(
    @Query('companyId') companyId: string,
    @Query('salonId') salonId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ): Promise<RosterSyncResult> {
    if (!companyId || !salonId || !dateFrom || !dateTo) {
      throw new BadRequestException(
        'companyId, salonId, dateFrom, and dateTo query params are all required (dates as YYYY-MM-DD)',
      );
    }
    return this.syncService.syncRosterForSalon({ companyId, salonId, dateFrom, dateTo });
  }

  // §5 employee_salon_assignments — flips is_active to false for anyone with
  // no roster in a salon for 30+ days. Independent of any single sync run
  // (a salon with zero roster activity this period still needs stale
  // assignments cleared).
  @Post('assignments/deactivate-stale')
  async deactivateStale(): Promise<{ deactivated: number }> {
    const deactivated = await this.syncService.deactivateStaleAssignments();
    return { deactivated };
  }
}
