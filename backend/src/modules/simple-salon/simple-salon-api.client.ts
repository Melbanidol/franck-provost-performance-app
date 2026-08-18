import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Auth flow confirmed against the real Simple Salon API docs
// (api.simplesalon.com/docs/v1 — "Initial Setup" and "Authentication"
// sections). Everything in this file now follows a verified contract, not a
// guess:
//
//  1. Company Token (computed once per company, not per request):
//     hex(HMAC-SHA256(signKey, `${partnerToken}-${companyId}`))
//  2. Login: POST {SIMPLE_SALON_API_URL}/v1/login
//       headers: Content-Type, User-Agent, X-Company-Token, X-Partner-Token
//       body: { username, password, company_id }
//     → { success, token, api_url, expiry, operator, ... }
//  3. Every other call: POST {api_url}/v1/{method} with
//       header Authorization: Bearer {token}
//     — this API is POST/RPC-style throughout (even "get" endpoints), not
//     REST-with-query-params, per every example in the docs.
//  4. Refresh: POST {api_url}/v1/refresh with { token } → new token/api_url/
//     expiry. Falls back to a full re-login if refresh fails (per docs: an
//     expired-and-long-unused token may need a fresh login regardless).
//
// The roster endpoints (POST /v1/roster/list, POST /v1/roster_type/list) are
// now also confirmed against the docs — see simple-salon-roster-sync.service.ts.
// Still unconfirmed: whether options.expanded_fields:["roster_type"] actually
// embeds the roster_type object on /v1/roster/list (the docs show that
// pattern for a sibling endpoint, Roster Rates, but not spelled out for
// Rosters itself) — handled defensively either way, see that file. Also
// still open: performance/appointments/POS endpoints for the future
// daily_performance sync (task #18) haven't been looked at yet.
// ---------------------------------------------------------------------------

interface LoginResponse {
  success: boolean;
  token: string;
  api_url: string;
  expiry: string;
  operator?: unknown;
  login_notice?: unknown;
}

interface SimpleSalonSession {
  token: string;
  apiUrl: string;
  expiresAt: Date;
}

const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class SimpleSalonApiClient {
  private readonly logger = new Logger(SimpleSalonApiClient.name);
  private readonly sessions = new Map<string, SimpleSalonSession>();

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.requireEnv('SIMPLE_SALON_API_URL');
  }

  private get partnerToken(): string {
    return this.requireEnv('SIMPLE_SALON_TOKEN');
  }

  private get signKey(): string {
    return this.requireEnv('SIMPLE_SALON_SIGN_KEY');
  }

  private get userAgent(): string {
    return (
      this.config.get<string>('SIMPLE_SALON_USER_AGENT') ??
      'FranckProvostPerformanceApp/0.1 (NestJS backend)'
    );
  }

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env var ${key} — check backend/.env`);
    }
    return value;
  }

  // Docs: "Initial Setup > For Partners > Generating a Company Token" —
  // combine Partner Token + Company ID with a dash, HMAC-SHA256 it with the
  // Signing Key (UTF8), hex digest (already lowercase alphanumeric, matches
  // the doc's stated requirement).
  private computeCompanyToken(companyId: string): string {
    return createHmac('sha256', this.signKey).update(`${this.partnerToken}-${companyId}`, 'utf8').digest('hex');
  }

  // Resolves username/password for a companyId from the 3 sandbox accounts
  // configured in .env (Dome + 2 children). Production companies aren't
  // configured this way yet — this only covers sandbox testing.
  private resolveCredentials(companyId: string): { username: string; password: string } {
    const accounts: Array<{ idKey: string; userKey: string; passKey: string }> = [
      { idKey: 'SIMPLE_SALON_DOME_COMPANY_ID', userKey: 'SIMPLE_SALON_DOME_USERNAME', passKey: 'SIMPLE_SALON_DOME_PASSWORD' },
      { idKey: 'SIMPLE_SALON_CHILD1_COMPANY_ID', userKey: 'SIMPLE_SALON_CHILD1_USERNAME', passKey: 'SIMPLE_SALON_CHILD1_PASSWORD' },
      { idKey: 'SIMPLE_SALON_CHILD2_COMPANY_ID', userKey: 'SIMPLE_SALON_CHILD2_USERNAME', passKey: 'SIMPLE_SALON_CHILD2_PASSWORD' },
    ];
    for (const acc of accounts) {
      if (this.config.get<string>(acc.idKey) === companyId) {
        return {
          username: this.requireEnv(acc.userKey),
          password: this.requireEnv(acc.passKey),
        };
      }
    }
    throw new BadRequestException(
      `No configured username/password for companyId ${companyId} — check backend/.env (only the 3 sandbox accounts are configured).`,
    );
  }

  private async login(companyId: string): Promise<SimpleSalonSession> {
    const { username, password } = this.resolveCredentials(companyId);
    const companyToken = this.computeCompanyToken(companyId);

    const response = await fetch(`${this.baseUrl}/v1/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
        'X-Company-Token': companyToken,
        'X-Partner-Token': this.partnerToken,
      },
      body: JSON.stringify({ username, password, company_id: Number(companyId) }),
    });
    const body = (await response.json()) as LoginResponse;
    if (!response.ok || !body.success) {
      throw new BadRequestException(`Simple Salon login failed for company ${companyId}: ${JSON.stringify(body)}`);
    }

    const session: SimpleSalonSession = { token: body.token, apiUrl: body.api_url, expiresAt: new Date(body.expiry) };
    this.sessions.set(companyId, session);
    this.logger.log(`Logged in to Simple Salon company ${companyId}, api_url=${session.apiUrl}`);
    return session;
  }

  private async refresh(companyId: string, session: SimpleSalonSession): Promise<SimpleSalonSession> {
    const response = await fetch(`${session.apiUrl}/v1/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.token }),
    });
    const body = (await response.json()) as LoginResponse;
    if (!response.ok || !body.success) {
      this.logger.warn(`Refresh failed for company ${companyId}, falling back to full login`);
      return this.login(companyId);
    }
    const refreshed: SimpleSalonSession = { token: body.token, apiUrl: body.api_url, expiresAt: new Date(body.expiry) };
    this.sessions.set(companyId, refreshed);
    return refreshed;
  }

  private async getSession(companyId: string): Promise<SimpleSalonSession> {
    const existing = this.sessions.get(companyId);
    if (!existing) return this.login(companyId);
    if (existing.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) return existing;
    return this.refresh(companyId, existing);
  }

  // Raw diagnostic call — POST {api_url}{path} with the session's Bearer
  // token, whatever body you give it. Returns status + body untouched. Use
  // this to confirm the real roster/appointments endpoint path and response
  // shape before trusting anything in simple-salon-roster-sync.service.ts.
  async rawPost(
    companyId: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ status: number; ok: boolean; body: unknown; apiUrl: string }> {
    const session = await this.getSession(companyId);
    const response = await fetch(`${session.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON — return raw text, still useful for diagnosis
    }
    return { status: response.status, ok: response.ok, body: parsed, apiUrl: session.apiUrl };
  }

  async post<T = unknown>(companyId: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const result = await this.rawPost(companyId, path, body);
    if (!result.ok) {
      throw new BadRequestException(
        `Simple Salon API ${path} returned ${result.status}: ${JSON.stringify(result.body)}`,
      );
    }
    return result.body as T;
  }
}
