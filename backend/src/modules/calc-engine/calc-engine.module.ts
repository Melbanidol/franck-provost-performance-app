import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DailyPerformance,
  DailyTarget,
  Employee,
  EmployeeCommission,
  EmployeeLevelHistory,
  EmployeePerformanceTier,
  EmployeeSalonAssignment,
  FlaggedWeek,
  FormulaSetting,
  KpiTarget,
  LevelTarget,
  PerformanceTier,
  RateCard,
  RosterHour,
} from '../../database/entities';
import { CalcEngineService } from './calc-engine.service';
import { CalcReferenceDataService } from './services/calc-reference-data.service';
import { CommissionService } from './services/commission.service';
import { FlaggedWeekService } from './services/flagged-week.service';
import { KpiTargetService } from './services/kpi-target.service';
import { LevelResolutionService } from './services/level-resolution.service';
import { PerformanceTierService } from './services/performance-tier.service';
import { RosterWeekService } from './services/roster-week.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeSalonAssignment,
      EmployeeLevelHistory,
      RosterHour,
      RateCard,
      FormulaSetting,
      LevelTarget,
      PerformanceTier,
      KpiTarget,
      DailyTarget,
      DailyPerformance,
      EmployeeCommission,
      EmployeePerformanceTier,
      FlaggedWeek,
    ]),
  ],
  providers: [
    CalcEngineService,
    CalcReferenceDataService,
    LevelResolutionService,
    RosterWeekService,
    KpiTargetService,
    CommissionService,
    PerformanceTierService,
    FlaggedWeekService,
  ],
  exports: [CalcEngineService],
})
export class CalcEngineModule {}
