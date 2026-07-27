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
// contracted_hours_per_week: contracted employees are paid for their
// contracted weekly hours (e.g. 38h/35h/20h), not for whatever they actually
// worked that week — over/under hours are banked and made up in time on a
// later week, not paid out or clawed back that week. This is functionally
// the old §6.3 "fixed_salary" case, now scoped correctly to
// employment_type = 'contracted' instead of a separate pay_type. Only
// meaningful for contracted employees (CHECK below); casual is paid for
// actual hours worked (no banking), freelancer has no hourly pay at all.
@Entity('employees')
@Check(
  `("level" = 'head_stylist' AND "employment_type" = 'freelancer')
   OR ("level" <> 'head_stylist' AND "employment_type" <> 'freelancer')`,
)
@Check(`"employment_type" = 'contracted' OR "contracted_hours_per_week" IS NULL`)
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

  // §4.3 — contracted (fixed weekly contract hours, hourly via rate_card) |
  // casual (paid for actual hours worked, no target) | freelancer (all
  // head_stylist, flat 40% commission, no hourly rate at all).
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

  // Weekly contract hours (38 / 35 / 20 ...). Only set for employment_type =
  // 'contracted' (enforced by CHECK above).
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
