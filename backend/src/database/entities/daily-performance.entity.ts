import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Salon } from './salon.entity';

// §5 daily_performance — actuals derived from the Simple Salon POS feed,
// the source of truth compared against kpi_targets/daily_targets.
@Entity('daily_performance')
@Index(['employeeId', 'salonId', 'date'], { unique: true })
export class DailyPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'salon_id', type: 'uuid' })
  salonId: string;

  @ManyToOne(() => Salon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'service_sales', type: 'numeric', precision: 12, scale: 2, default: 0 })
  serviceSales: string;

  @Column({ name: 'retail_sales', type: 'numeric', precision: 12, scale: 2, default: 0 })
  retailSales: string;

  @Column({ name: 'clients_served', type: 'integer', default: 0 })
  clientsServed: number;

  @Column({ name: 'treatments_count', type: 'integer', default: 0 })
  treatmentsCount: number;

  @Column({ name: 'products_sold', type: 'integer', default: 0 })
  productsSold: number;

  @Column({ name: 'rebooking_rate', type: 'numeric', precision: 5, scale: 2, nullable: true })
  rebookingRate: string | null;

  @Column({
    name: 'avg_spend_per_client',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  avgSpendPerClient: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
