import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

// §5 streaks — one row per employee (§7.3).
@Entity('streaks')
export class Streak {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @OneToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'current_streak', type: 'integer', default: 0 })
  currentStreak: number;

  @Column({ name: 'longest_streak', type: 'integer', default: 0 })
  longestStreak: number;

  @Column({ name: 'last_active_date', type: 'date', nullable: true })
  lastActiveDate: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
