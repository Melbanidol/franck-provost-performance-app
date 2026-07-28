import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeSalonAssignment } from '../../database/entities';
import { CalcReferenceDataService } from './services/calc-reference-data.service';
import { CommissionService } from './services/commission.service';
import { FlaggedWeekService } from './services/flagged-week.service';
import { KpiTargetService } from './services/kpi-target.service';
import { LevelResolutionService } from './services/level-resolution.service';
import { PerformanceTierService } from './services/performance-tier.service';
import { RosterWeekService } from './services/roster-week.service';

// §6.9 — single entry point a future Simple Salon roster-sync job calls
// whenever a roster is published/updated for an employee: recomputes every
// weekly + daily target, commission, performance tier, and hours-deviation
// flag for that employee/week, across every active salon assignment.
@Injectable()
export class CalcEngineService {
  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeSalonAssignment)
    private readonly assignmentRepo: Repository<EmployeeSalonAssignment>,
    private readonly referenceData: CalcReferenceDataService,
    private readonly levelResolution: LevelResolutionService,
    private readonly rosterWeek: RosterWeekService,
    private readonly kpiTargets: KpiTargetService,
    private readonly commissions: CommissionService,
    private readonly performanceTiers: PerformanceTierService,
    private readonly flaggedWeeks: FlaggedWeekService,
  ) {}

  async recalculateEmployeeWeek(employeeId: string, weekStart: string): Promise<void> {
    const employee = await this.employeeRepo.findOneByOrFail({ id: employeeId });

    const assignments = await this.assignmentRepo.find({
      where: { employeeId, isActive: true },
    });

    const [rosterRows, formulaSettings, rateCard, tiers, levelAtWeek] = await Promise.all([
      this.rosterWeek.loadWeek(employeeId, weekStart),
      this.referenceData.loadFormulaSettings(),
      this.referenceData.loadRateCard(),
      this.referenceData.loadPerformanceTiers(),
      this.levelResolution.resolveLevelAt(employee, weekStart),
    ]);

    const avgSpendTarget = await this.referenceData.loadAvgSpendTarget(levelAtWeek);
    const bySalon = this.rosterWeek.groupBySalon(rosterRows);
    const totalScheduledHours = this.rosterWeek.totalHours(rosterRows);

    for (const assignment of assignments) {
      const days = bySalon.get(assignment.salonId) ?? [];

      const targets = await this.kpiTargets.upsertForSalon({
        employee,
        levelAtWeek,
        salonId: assignment.salonId,
        isPrimarySalon: assignment.isPrimary,
        weekStart,
        days,
        rateCard,
        formulaSettings,
        avgSpendTarget,
      });

      const actuals = await this.commissions.upsertForSalon({
        employee,
        salonId: assignment.salonId,
        weekStart,
        targets,
        formulaSettings,
      });

      await this.performanceTiers.upsertForSalon({
        employeeId: employee.id,
        salonId: assignment.salonId,
        weekStart,
        serviceActual: actuals.serviceActual,
        serviceTarget: targets.serviceTarget,
        tiers,
      });
    }

    await this.flaggedWeeks.upsertForEmployee({ employee, weekStart, totalScheduledHours });
  }
}
