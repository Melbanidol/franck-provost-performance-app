import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

// §5 formula_settings — every numeric constant used by the calculation
// engine (§6.1 service_multiplier_1/2, §6.4 retail_rate, §6.5 rebooking_target,
// §6.7 treatment/retail_conversion_target...) lives here, editable by HQ
// without a redeploy, instead of being hard-coded.
@Entity('formula_settings')
export class FormulaSetting {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key: string;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  value: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByEmployee: Employee | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
