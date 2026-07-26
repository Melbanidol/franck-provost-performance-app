import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EmployeeLevel } from './enums';

// §5 level_targets — paramétrable par le siège (§6.6).
@Entity('level_targets')
export class LevelTarget {
  @PrimaryColumn({
    type: 'enum',
    enum: EmployeeLevel,
    enumName: 'employee_level_enum',
  })
  level: EmployeeLevel;

  @Column({ name: 'avg_spend_target', type: 'numeric', precision: 10, scale: 2 })
  avgSpendTarget: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
