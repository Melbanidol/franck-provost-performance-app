import { Controller, Get, Header, Query } from '@nestjs/common';
import { XeroOauthService } from './xero-oauth.service';

// Deliberately a separate, unprefixed controller: the redirect URI
// registered on the Xero app is exactly http://localhost:3000/callback (no
// /xero prefix), and Xero rejects a code exchange whose redirect_uri
// doesn't match that registration byte-for-byte. Everything else Xero-related
// lives under /xero/* (see xero.controller.ts).
@Controller()
export class XeroCallbackController {
  constructor(private readonly oauth: XeroOauthService) {}

  @Get('callback')
  @Header('Content-Type', 'text/html')
  async callback(@Query('code') code: string, @Query('state') state: string): Promise<string> {
    const connections = await this.oauth.handleCallback(code, state);
    const orgs = connections.map((c) => c.tenantName ?? c.tenantId).join(', ');
    return `<h1>Xero connected ✅</h1><p>Organisation(s): ${orgs}</p><p>You can close this tab. Try <code>GET /xero/status</code> or <code>GET /xero/payroll/gross-wage?weekStart=YYYY-MM-DD</code> next.</p>`;
  }
}
