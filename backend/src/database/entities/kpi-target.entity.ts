import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Salon } from './salon.entity';

// §5 kpi_targets — one row per employee PER SALON per week (§2 "coiffeurs
// multi-salons", §6.10), covering every weekly KPI target.
//
// service_target/retail_target are nullable: §4.3's target/commission table
// makes them conditional on employment_type — casual has no service_target,
// freelancer has neither service_target nor retail_target. NULL means "no
// target for this employment_type", distinct from a $0 target.
@Entity('kpi_targets')
@Index(['employeeId', 'salonId', 'weekStart'], { unique: true })
export class KpiTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  // weighted_wage(salon) × 1.2 × 3 (§6.1, §6.10) — null for casual/freelancer (§4.3)
  @Column({ name: 'service_target', type: 'numeric', precision: 12, scale: 2, nullable: true })
  serviceTarget: string | null;

  // $14/h × heures planifiées dans ce salon (§6.4) — null for freelancer (§4.3)
  @Column({ name: 'retail_target', type: 'numeric', precision: 12, scale: 2, nullable: true })
  retailTarget: string | null;

  // 50%, constant (§6.5)
  @Column({ name: 'rebooking_target', type: 'numeric', precision: 5, scale: 2 })
  rebookingTarget: string;

  // selon employees.level (§6.6)
  @Column({ name: 'avg_spend_target', type: 'numeric', precision: 10, scale: 2 })
  avgSpendTarget: string;

  // 50%, constant (§6.7)
  @Column({ name: 'treatment_conversion_target', type: 'numeric', precision: 5, scale: 2 })
  treatmentConversionTarget: string;

  // 50%, constant (§6.7)
  @Column({ name: 'retail_conversion_target', type: 'numeric', precision: 5, scale: 2 })
  retailConversionTarget: string;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;
}
