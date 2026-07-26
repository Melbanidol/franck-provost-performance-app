import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Salon } from './salon.entity';
import { DayType } from './enums';

// §5 roster_hours — daily, per-salon roster pulled from Simple Salon (§4.1).
// This is the raw input to both the daily weighting (§6.2) and the
// multi-salon wage allocation (§6.10).
@Entity('roster_hours')
@Index(['employeeId', 'salonId', 'date'], { unique: true })
export class RosterHour {
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
