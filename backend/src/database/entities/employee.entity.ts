import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeLevel, EmployeeRole, PayType } from './enums';

// §5 employees. Columns beyond the four listed in the spec code block are
// additions required by other sections and are called out in the PR/summary:
//  - first_name/last_name/email/phone/pin_hash: app-level PIN auth + SMS/email
//    invitation on auto-onboarding (§2 "Authentification", §4.1 "Onboarding automatique")
//  - contracted_hours_per_week: needed to detect fixed_salary deviations (§6.3)
@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Simple Salon operator ID — nullable until the first roster sync creates the employee.
  @Index({ unique: true, where: 'simple_salon_id IS NOT NULL' })
  @Column({ name: 'simple_salon_id', type: 'varchar', length: 128, nullable: true })
  simpleSalonId: string | null;

  // Xero Payroll AU employee ID — nullable until matched during payroll sync.
  @Index({ unique: true, where: 'xero_employee_id IS NOT NULL' })
  @Column({ name: 'xero_employee_id', type: 'varchar', length: 128, nullable: true })
  xeroEmployeeId: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 128 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 128 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  // Hash of the app-specific PIN (§2) — never the Simple Salon PIN. Null until
  // the employee completes onboarding and sets their PIN.
  @Column({ name: 'pin_hash', type: 'varchar', length: 255, nullable: true })
  pinHash: string | null;

  @Column({
    type: 'enum',
    enum: EmployeeRole,
    enumName: 'employee_role_enum',
    default: EmployeeRole.STYLIST,
  })
  role: EmployeeRole;

  @Column({
    name: 'pay_type',
    type: 'enum',
    enum: PayType,
    enumName: 'pay_type_enum',
  })
  payType: PayType;

  @Column({
    type: 'enum',
    enum: EmployeeLevel,
    enumName: 'employee_level_enum',
  })
  level: EmployeeLevel;

  // Only meaningful for pay_type = fixed_salary (§6.3).
  @Column({
    name: 'contracted_hours_per_week',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  contractedHoursPerWeek: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
