import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeLevel, EmployeeRole, EmploymentType } from './enums';

// §5 employees. Columns beyond id/simple_salon_id/xero_employee_id/role/
// employment_type/level are additions required by other sections, called out
// in the PR/summary: first_name/last_name/email/phone/pin_hash back the
// app-level PIN auth + SMS/email invitation on auto-onboarding (§2
// "Authentification", §4.1 "Onboarding automatique").
//
// pay_type (fixed_salary | hourly_variable) and contracted_hours_per_week
// from the previous revision are DROPPED here: §4.3 replaces pay_type with
// employment_type, and every employment_type now resolves to either an
// hourly rate (contracted/casual, via rate_card) or a flat commission with
// no target at all (freelancer) — there is no "fixed salary" case left to
// flag deviations against. See PR summary for the reasoning; flag if this
// call is wrong.
@Entity('employees')
@Check(
  `("level" = 'head_stylist' AND "employment_type" = 'freelancer')
   OR ("level" <> 'head_stylist' AND "employment_type" <> 'freelancer')`,
)
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

  // §4.3 — contracted (hourly via rate_card) | casual (hourly, no target) |
  // freelancer (all head_stylist, flat 40% commission, no rate at all).
  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    enumName: 'employment_type_enum',
  })
  employmentType: EmploymentType;

  @Column({
    type: 'enum',
    enum: EmployeeLevel,
    enumName: 'employee_level_enum',
  })
  level: EmployeeLevel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
