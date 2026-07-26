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
import { EmployeeLevel } from './enums';

// Addition beyond the literal §5 table list, required by §6.6: "Si un
// coiffeur change de niveau, l'objectif doit être recalculé à partir de la
// date du changement (historiser le niveau, ne pas juste écraser la valeur
// courante)". employees.level always holds the current level; this table
// keeps the timeline so avg_spend_target can be resolved correctly for any
// past week. effective_to = null means "current".
@Entity('employee_level_history')
@Index(['employeeId', 'effectiveFrom'])
export class EmployeeLevelHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: EmployeeLevel,
    enumName: 'employee_level_enum',
  })
  level: EmployeeLevel;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
