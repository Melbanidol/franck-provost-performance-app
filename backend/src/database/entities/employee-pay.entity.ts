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
import { PaySource } from './enums';

// §5 employee_pay — weekly snapshot pulled from Xero Payroll AU (§4.2, read-only).
@Entity('employee_pay')
@Index(['employeeId', 'weekStart'], { unique: true })
export class EmployeePay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'gross_wage', type: 'numeric', precision: 12, scale: 2 })
  grossWage: string;

  @Column({
    type: 'enum',
    enum: PaySource,
    enumName: 'pay_source_enum',
  })
  source: PaySource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
