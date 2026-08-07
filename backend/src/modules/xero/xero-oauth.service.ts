import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { XeroConnection } from '../../database/entities';

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';

// How long before actual expiry we proactively refresh, so a request never
// races a token that's about to die mid-call.
const REFRESH_SKEW_MS = 60_000;
// How long a CSRF `state` value stays valid between /connect and /callback.
const STATE_TTL_MS = 10 * 60_000;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface XeroTenantConnection {
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

// Handles the OAuth2 authorization-code flow against Xero (§ Xero Payroll AU
// integration) and keeps the resulting access/refresh tokens fresh. State
// (§ CSRF nonce) is kept in-memory — fine for a single-instance MVP
// deployment; would need a shared store (Redis, DB row) behind a
// load-balanced deployment.
@Injectable()
export class XeroOauthService {
  private readonly logger = new Logger(XeroOauthService.name);
  private readonly pendingStates = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(XeroConnection)
    private readonly connectionRepo: Repository<XeroConnection>,
  ) {}

  private get clientId(): string {
    return this.requireEnv('XERO_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.requireEnv('XERO_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.requireEnv('XERO_REDIRECT_URI');
  }

  private get scopes(): string {
    // Space-separated, per OAuth2 spec. Defaults match what was agreed for
    // this integration: read-only payroll (employees + pay runs) plus the
    // minimum identity scopes Xero requires for the consent screen.
    return (
      this.config.get<string>('XERO_SCOPES') ??
      'payroll.employees payroll.payruns offline_access openid profile email'
    );
  }

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env var ${key} — check backend/.env`);
    }
    return value;
  }

  // §1 of the flow: build the URL the user visits in a browser to grant
  // consent. Returns the state value too so the caller (controller) can log
  // it if needed for debugging.
  buildAuthorizeUrl(): { url: string; state: string } {
    const state = randomBytes(16).toString('hex');
    this.pendingStates.set(state, Date.now() + STATE_TTL_MS);
    this.pruneExpiredStates();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      state,
    });

    return { url: `${AUTHORIZE_URL}?${params.toString()}`, state };
  }

  // §2 of the flow: Xero redirects back to XERO_REDIRECT_URI with ?code=&state=.
  // Exchanges the code for tokens, resolves which tenant(s) it grants access
  // to, and persists one xero_connections row per tenant.
  async handleCallback(code: string, state: string): Promise<XeroConnection[]> {
    if (!code) throw new BadRequestException('Missing "code" query param from Xero redirect');
    this.validateState(state);

    const tokens = await this.exchangeCodeForTokens(code);
    const tenants = await this.fetchConnectedTenants(tokens.access_token);

    if (tenants.length === 0) {
      throw new BadRequestException(
        'Xero returned no connected organisations for this consent — was a tenant selected on the consent screen?',
      );
    }

    const saved: XeroConnection[] = [];
    for (const tenant of tenants) {
      const row = await this.upsertConnection(tenant, tokens);
      saved.push(row);
    }
    return saved;
  }

  // Returns a live, non-expired access token for the given tenant (or the
  // only/most recently connected one if tenantId is omitted), refreshing it
  // first if it's within REFRESH_SKEW_MS of expiring.
  async getValidAccessToken(tenantId?: string): Promise<{ accessToken: string; tenantId: string }> {
    const connection = tenantId
      ? await this.connectionRepo.findOne({ where: { tenantId } })
      : await this.connectionRepo.findOne({ where: {}, order: { updatedAt: 'DESC' } });

    if (!connection) {
      throw new NotFoundException(
        'No Xero connection on file — visit GET /xero/connect first to authorize this app.',
      );
    }

    if (connection.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
      return { accessToken: connection.accessToken, tenantId: connection.tenantId };
    }

    this.logger.log(`Refreshing Xero access token for tenant ${connection.tenantId}`);
    const tokens = await this.refreshTokens(connection.refreshToken);
    const updated = await this.upsertConnection(
      { tenantId: connection.tenantId, tenantName: connection.tenantName ?? '', tenantType: '' },
      tokens,
    );
    return { accessToken: updated.accessToken, tenantId: updated.tenantId };
  }

  private validateState(state: string): void {
    this.pruneExpiredStates();
    if (!state || !this.pendingStates.has(state)) {
      throw new BadRequestException(
        'Invalid or expired OAuth state — restart the flow from GET /xero/connect (states expire after 10 minutes and are single-use).',
      );
    }
    this.pendingStates.delete(state);
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.pendingStates) {
      if (expiresAt < now) this.pendingStates.delete(key);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    return this.postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    );
  }

  private async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    return this.postToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    );
  }

  private async postToken(body: URLSearchParams): Promise<TokenResponse> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Xero token endpoint returned ${response.status}: ${text}`);
    }

    return (await response.json()) as TokenResponse;
  }

  private async fetchConnectedTenants(accessToken: string): Promise<XeroTenantConnection[]> {
    const response = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Xero /connections returned ${response.status}: ${text}`);
    }
    const raw = (await response.json()) as Array<{
      tenantId: string;
      tenantName: string;
      tenantType: string;
    }>;
    return raw.map((t) => ({ tenantId: t.tenantId, tenantName: t.tenantName, tenantType: t.tenantType }));
  }

  private async upsertConnection(
    tenant: XeroTenantConnection,
    tokens: TokenResponse,
  ): Promise<XeroConnection> {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.connectionRepo.upsert(
      {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope,
      },
      ['tenantId'],
    );
    const saved = await this.connectionRepo.findOneOrFail({ where: { tenantId: tenant.tenantId } });
    return saved;
  }
}
