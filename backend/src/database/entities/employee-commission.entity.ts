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

// §5 employee_commissions — computed weekly, per salon (§6.8, §6.10), once
// actual sales for the week are known.
@Entity('employee_commissions')
@Index(['employeeId', 'salonId', 'weekStart'], { unique: true })
export class EmployeeCommission {
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

  @Column({ name: 'retail_actual', type: 'numeric', precision: 12, scale: 2 })
  retailActual: string;

  @Column({ name: 'retail_target', type: 'numeric', precision: 12, scale: 2 })
  retailTarget: string;

  @Column({ name: 'retail_target_reached', type: 'boolean' })
  retailTargetReached: boolean;

  // retail_actual × 20% si target atteint, sinon 0 — rétroactif (§6.8)
  @Column({ name: 'commission_retail', type: 'numeric', precision: 12, scale: 2 })
  commissionRetail: string;

  @Column({ name: 'service_actual', type: 'numeric', precision: 12, scale: 2 })
  serviceActual: string;

  @Column({ name: 'service_target', type: 'numeric', precision: 12, scale: 2 })
  serviceTarget: string;

  @Column({ name: 'service_target_reached', type: 'boolean' })
  serviceTargetReached: boolean;

  // (service_actual − service_target) × 30% si target atteint, sinon 0 — marginal (§6.8)
  @Column({ name: 'commission_service', type: 'numeric', precision: 12, scale: 2 })
  commissionService: string;

  @Column({ name: 'total_commission', type: 'numeric', precision: 12, scale: 2 })
  totalCommission: string;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;
}
