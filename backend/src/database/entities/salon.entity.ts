import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// §5 salons — 6 Sydney + 1 Melbourne on Australia/Sydney, 1 Townsville on
// Australia/Brisbane. Stored as an IANA name (not a fixed UTC offset) so that
// day/week boundaries stay correct across daylight saving (§3, §6.9).
@Entity('salons')
export class Salon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
