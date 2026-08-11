import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// IMPORTANT — read before touching auth or endpoint paths in this file.
//
// This client has never completed a real call against the Simple Salon
// sandbox. All we have to go on is the credentials email (§ Simple Salon
// sandbox): a base URL, a "Token", and a "Sign Key" — no endpoint reference,
// no auth scheme documentation, no example request. Everything below —
// the request-signing scheme, the header names, and the default roster
// endpoint path — is a best-effort guess based on common patterns for this
// class of API (token + HMAC-signed request), NOT a verified contract.
//
// Two things are deliberately built to make correcting those guesses cheap
// once real sandbox responses are available:
//  - buildAuthHeaders() is the ONLY place the auth scheme lives.
//  - the roster endpoint path is a runtime setting (SIMPLE_SALON_ROSTER_PATH),
//    not hardcoded, and SimpleSalonController#rawGet lets you probe arbitrary
//    paths against the sandbox without a code change.
// Use GET /simple-salon/raw?path=... first, confirm what actually comes
// back, then fix this file if the guesses were wrong.
// ---------------------------------------------------------------------------

const DEFAULT_ROSTER_PATH = '/api/v1/roster';

@Injectable()
export class SimpleSalonApiClient {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.requireEnv('SIMPLE_SALON_API_URL');
  }

  private get token(): string {
    return this.requireEnv('SIMPLE_SALON_TOKEN');
  }

  private get signKey(): string {
    return this.requireEnv('SIMPLE_SALON_SIGN_KEY');
  }

  get rosterPath(): string {
    return this.config.get<string>('SIMPLE_SALON_ROSTER_PATH') ?? DEFAULT_ROSTER_PATH;
  }

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env var ${key} — check backend/.env`);
    }
    return value;
  }

  // Best-effort guess: token + timestamp signed with the sign key via
  // HMAC-SHA256, sent as two headers alongside the timestamp. Common shape
  // for this style of API, but UNVERIFIED — see file header.
  private buildAuthHeaders(companyId: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', this.signKey).update(`${this.token}:${timestamp}`).digest('hex');
    return {
      'X-API-Token': this.token,
      'X-API-Timestamp': timestamp,
      'X-API-Signature': signature,
      'X-Company-Id': companyId,
      Accept: 'application/json',
    };
  }

  // Fetches whatever path you give it, with our best-guess auth headers
  // attached, and returns the raw status + body untouched. Use this to
  // probe the real API before trusting any mapping in
  // simple-salon-roster-sync.service.ts.
  async rawGet(
    companyId: string,
    path: string,
    query?: Record<string, string>,
  ): Promise<{ status: number; ok: boolean; body: unknown }> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), { headers: this.buildAuthHeaders(companyId) });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON — return the raw text as-is, still useful for diagnosis
    }
    return { status: response.status, ok: response.ok, body };
  }

  async get<T = unknown>(companyId: string, path: string, query?: Record<string, string>): Promise<T> {
    const result = await this.rawGet(companyId, path, query);
    if (!result.ok) {
      throw new BadRequestException(
        `Simple Salon API ${path} returned ${result.status}: ${JSON.stringify(result.body)}`,
      );
    }
    return result.body as T;
  }
}
