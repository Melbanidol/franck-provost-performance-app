import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Salon } from './salon.entity';

// §5 employee_salon_assignments — replaces a single salon_id on employees so
// that coiffeurs working across several of the group's salons (§2) are
// represented correctly. Updated by the Simple Salon roster sync job (§4.1):
// is_active flips to false after 1 rolling month with no roster in that salon;
// an employee has left the group once is_active is false on every assignment.
@Entity('employee_salon_assignments')
export class EmployeeSalonAssignment {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @PrimaryColumn({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'first_seen_roster_date', type: 'date' })
  firstSeenRosterDate: string;

  @Column({ name: 'last_seen_roster_date', type: 'date' })
  lastSeenRosterDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
