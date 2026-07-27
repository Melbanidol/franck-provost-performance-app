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
import { DayType } from './enums';

// §5 daily_targets — daily breakdown of the cumulative $ KPIs (service,
// retail), per salon. The spec lists a `week_id` column, but no `weeks`
// table is defined anywhere in §5; the natural key for "which week is this"
// is week_start (date), so week_id is replaced by week_start here — flagged
// for confirmation in the summary rather than inventing an unspecified table.
@Entity('daily_targets')
@Index(['employeeId', 'salonId', 'date'], { unique: true })
export class DailyTarget {
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

  @Column({ type: 'date' })
  date: string;

  @Column({
    name: 'day_type',
    type: 'enum',
    enum: DayType,
    enumName: 'day_type_enum',
  })
  dayType: DayType;

  @Column({ name: 'hours_scheduled', type: 'numeric', precision: 5, scale: 2 })
  hoursScheduled: string;

  // heures_planifiées(jour) × taux_horaire(type_de_jour) (§6.2)
  @Column({ name: 'weighted_hours', type: 'numeric', precision: 10, scale: 4 })
  weightedHours: string;

  // Null for casual/freelancer — no service_target to break down (§4.3)
  @Column({
    name: 'daily_service_target',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  dailyServiceTarget: string | null;

  // $14 × heures du jour — non pondéré (§6.4). Null for freelancer (§4.3)
  @Column({ name: 'daily_retail_target', type: 'numeric', precision: 12, scale: 2, nullable: true })
  dailyRetailTarget: string | null;

  // Replaces the spec's `week_id` — see class comment.
  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
