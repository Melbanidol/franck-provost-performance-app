import { Column, Entity, PrimaryColumn } from 'typeorm';

// §5 performance_tiers — configurable by HQ (§7.1). Bonus amounts are
// explicitly "not finalized" per the spec, so bonus_description stays free
// text/nullable rather than a structured amount for now.
@Entity('performance_tiers')
export class PerformanceTier {
  @PrimaryColumn({ name: 'tier_number', type: 'integer' })
  tierNumber: number;

  @Column({ name: 'threshold_pct', type: 'numeric', precision: 5, scale: 2 })
  thresholdPct: string;

  @Column({ name: 'bonus_description', type: 'text', nullable: true })
  bonusDescription: string | null;
}
