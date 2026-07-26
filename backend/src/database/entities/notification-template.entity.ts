import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationTrigger } from './enums';

// §5 notification_templates (§7.2).
@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: NotificationTrigger,
    enumName: 'notification_trigger_enum',
  })
  triggerType: NotificationTrigger;

  @Column({ name: 'threshold_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  thresholdPct: string | null;

  // Contains {first_name}, {kpi_name}, {percent_remaining} tokens.
  @Column({ name: 'message_template', type: 'text' })
  messageTemplate: string;

  @Column({ type: 'varchar', length: 64, default: 'Mel' })
  signature: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
