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
import { FlaggedWeekStatus } from './enums';

// Addition beyond the literal §5 table list, required by §6.3: for
// pay_type = fixed_salary, any deviation between scheduled roster hours and
// employees.contracted_hours_per_week "déclenche un flag de la semaine pour
// révision manuelle par le manager" — no table for this is listed in §5, so
// one is added here to make that requirement actually implementable.
@Entity('flagged_weeks')
@Index(['employeeId', 'salonId', 'weekStart'], { unique: true })
export class FlaggedWeek {
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

  @Column({ name: 'contracted_hours', type: 'numeric', precision: 5, scale: 2 })
  contractedHours: string;

  @Column({ name: 'scheduled_hours', type: 'numeric', precision: 5, scale: 2 })
  scheduledHours: string;

  @Column({
    type: 'enum',
    enum: FlaggedWeekStatus,
    enumName: 'flagged_week_status_enum',
    default: FlaggedWeekStatus.PENDING,
  })
  status: FlaggedWeekStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByEmployee: Employee | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
