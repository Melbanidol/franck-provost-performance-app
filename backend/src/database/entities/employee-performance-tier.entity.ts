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
import { PerformanceTier } from './performance-tier.entity';

// §5 employee_performance_tier — computed weekly, per salon, alongside
// commissions (§6.8, §7.1, §6.10).
@Entity('employee_performance_tier')
@Index(['employeeId', 'salonId', 'weekStart'], { unique: true })
export class EmployeePerformanceTier {
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

  @Column({ name: 'overperformance_pct', type: 'numeric', precision: 6, scale: 2 })
  overperformancePct: string;

  // Null when no tier was reached this week.
  @Column({ name: 'tier_reached', type: 'integer', nullable: true })
  tierReached: number | null;

  @ManyToOne(() => PerformanceTier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tier_reached' })
  tier: PerformanceTier | null;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;
}
