import { Column, PrimaryColumn } from 'typeorm';
import { Entity } from 'typeorm';

// Addition beyond the literal §5 table list — Simple Salon's own "Roster
// Types" admin config (Rostered ON, Sick, Public Holiday, Training,
// Franchisees Meeting, ...), synced/mirrored here so the calc engine knows
// which roster blocks are paid.
//
// A single flag drives everything downstream, confirmed simple on purpose:
// paid roster hours count toward the wage-based service_target (§6.1/§6.10),
// the retail_target (§6.4), and the contracted-hours quota check (§6.3).
// Unpaid blocks (Lunch, Unpaid Leave, Home Office, Time Owed, ...) are
// excluded from all three — but still stored in roster_hours for full
// fidelity with what Simple Salon actually reports.
@Entity('roster_types')
export class RosterType {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'is_paid', type: 'boolean' })
  isPaid: boolean;
}
