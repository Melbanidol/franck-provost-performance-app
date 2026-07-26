import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

// §5 employee_rates — one rate set per employee (pay is set at the employee
// level, not per salon), used to weight roster hours by day type (§6.2, §6.10).
@Entity('employee_rates')
export class EmployeeRate {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @OneToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'weekday_rate', type: 'numeric', precision: 10, scale: 2 })
  weekdayRate: string;

  @Column({ name: 'saturday_rate', type: 'numeric', precision: 10, scale: 2 })
  saturdayRate: string;

  @Column({ name: 'sunday_rate', type: 'numeric', precision: 10, scale: 2 })
  sundayRate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
