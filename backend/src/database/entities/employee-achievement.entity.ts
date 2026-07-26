import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Employee } from './employee.entity';
import { Achievement } from './achievement.entity';

// §5 employee_achievements — join table recording unlocked badges.
@Entity('employee_achievements')
export class EmployeeAchievement {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @PrimaryColumn({ name: 'achievement_id', type: 'uuid' })
  achievementId: string;

  @ManyToOne(() => Achievement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'achievement_id' })
  achievement: Achievement;

  @Column({ name: 'unlocked_at', type: 'timestamptz' })
  unlockedAt: Date;
}
