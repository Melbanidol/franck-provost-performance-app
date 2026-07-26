import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import {
  Salon,
  Employee,
  EmployeeSalonAssignment,
  EmployeeRate,
  EmployeeLevelHistory,
  LevelTarget,
  EmployeePay,
  RosterHour,
  KpiTarget,
  DailyTarget,
  EmployeeCommission,
  FormulaSetting,
  DailyPerformance,
  Achievement,
  EmployeeAchievement,
  Streak,
  PerformanceTier,
  EmployeePerformanceTier,
  NotificationTemplate,
  NotificationLog,
  FlaggedWeek,
} from '../database/entities';

dotenv.config();

// Used both by AppModule (via @nestjs/typeorm) and by the TypeORM CLI for
// migrations (npm run migration:run / migration:generate), so the schema
// definition never drifts between the running app and the migration tooling.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'franck_provost_performance',
  entities: [
    Salon,
    Employee,
    EmployeeSalonAssignment,
    EmployeeRate,
    EmployeeLevelHistory,
    LevelTarget,
    EmployeePay,
    RosterHour,
    KpiTarget,
    DailyTarget,
    EmployeeCommission,
    FormulaSetting,
    DailyPerformance,
    Achievement,
    EmployeeAchievement,
    Streak,
    PerformanceTier,
    EmployeePerformanceTier,
    NotificationTemplate,
    NotificationLog,
    FlaggedWeek,
  ],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});
