import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from './employee.entity';
import { NotificationTemplate } from './notification-template.entity';

// §5 notification_log — used to dedupe and enforce the ~2/day cap (§7.2).
@Entity('notification_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @ManyToOne(() => NotificationTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: NotificationTemplate;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
