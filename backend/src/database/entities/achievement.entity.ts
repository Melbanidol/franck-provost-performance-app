import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// §5 achievements — catalogue of unlockable badges (§7.3). unlock_condition
// is left as free text for now: the concrete rule set for badges is not
// defined anywhere in the spec, so it isn't modeled as structured data yet.
@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  icon: string;

  @Column({ name: 'unlock_condition', type: 'text' })
  unlockCondition: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
