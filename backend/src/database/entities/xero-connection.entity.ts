import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// OAuth2 session state for the Xero Payroll AU integration. Not part of
// spec §5 — this is integration plumbing, not domain data, which is why it
// lives outside the §5 entity set (employee_pay, populated from here, is the
// §5 table). MVP assumes a single connected Xero organisation (Franck
// Provost's own tenant); tenant_id is unique so re-running /xero/connect
// against the same org updates the existing row instead of duplicating it.
@Entity('xero_connections')
export class XeroConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'tenant_id', type: 'varchar', length: 64 })
  tenantId: string;

  @Column({ name: 'tenant_name', type: 'varchar', length: 255, nullable: true })
  tenantName: string | null;

  // Stored plaintext for MVP — this table is never exposed via any read API
  // and the DB itself is the trust boundary. Flagged as a follow-up to
  // encrypt at rest (or move to a secrets manager) before any real
  // deployment beyond local/dev testing.
  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'text' })
  scope: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
