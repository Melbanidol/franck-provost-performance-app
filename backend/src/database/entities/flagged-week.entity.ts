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
import { FlaggedWeekStatus } from './enums';

// Addition beyond the literal §5 table list, backing §6.3's fixed-hours
// deviation flag for employment_type = 'contracted' employees: they're paid
// for their contracted weekly hours regardless of what's actually rostered
// (over/under hours are banked and made up on a later week — see
// employee.entity.ts), and any deviation flags the week for manual review.
//
// Deliberately no salon_id: the contract is at the employee level, and hours
// can legitimately be split across a primary + secondary salon in the same
// week (§6.10) without that being a deviation — so scheduled_hours here is
// the SUM across every salon the employee worked that week, compared against
// their single contracted_hours_per_week.
@Entity('flagged_weeks')
@Index(['employeeId', 'weekStart'], { unique: true })
export class FlaggedWeek {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'contracted_hours', type: 'numeric', precision: 5, scale: 2 })
  contractedHours: string;

  // Sum of roster_hours.hours_scheduled across all salons for this employee/week.
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
