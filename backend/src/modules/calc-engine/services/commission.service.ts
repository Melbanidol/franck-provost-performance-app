import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyPerformance, Employee, EmployeeCommission } from '../../../database/entities';
import { computeRetailCommission, computeServiceCommission } from '../domain';
import { weekDates } from '../util/date';
import { FormulaSettingsValues } from './calc-reference-data.service';
import { SalonWeeklyTargets } from './kpi-target.service';

export interface SalonWeeklyActuals {
  serviceActual: number;
  retailActual: number;
}

// §6.8 — commissions computed from actual sales (daily_performance, sourced
// from the Simple Salon POS feed) against the targets kpi-target.service.ts
// just computed.
@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(DailyPerformance)
    private readonly dailyPerformanceRepo: Repository<DailyPerformance>,
    @InjectRepository(EmployeeCommission)
    private readonly commissionRepo: Repository<EmployeeCommission>,
  ) {}

  async loadWeeklyActuals(
    employeeId: string,
    salonId: string,
    weekStart: string,
  ): Promise<SalonWeeklyActuals> {
    const dates = weekDates(weekStart);
    const rows = await this.dailyPerformanceRepo
      .createQueryBuilder('p')
      .where('p.employee_id = :employeeId', { employeeId })
      .andWhere('p.salon_id = :salonId', { salonId })
      .andWhere('p.date IN (:...dates)', { dates })
      .getMany();

    return rows.reduce<SalonWeeklyActuals>(
      (acc, row) => ({
        serviceActual: acc.serviceActual + parseFloat(row.serviceSales),
        retailActual: acc.retailActual + parseFloat(row.retailSales),
      }),
      { serviceActual: 0, retailActual: 0 },
    );
  }

  async upsertForSalon(params: {
    employee: Employee;
    salonId: string;
    weekStart: string;
    targets: SalonWeeklyTargets;
    formulaSettings: FormulaSettingsValues;
  }): Promise<SalonWeeklyActuals> {
    const { employee, salonId, weekStart, targets, formulaSettings } = params;
    const actuals = await this.loadWeeklyActuals(employee.id, salonId, weekStart);

    const retail = computeRetailCommission({
      retailActual: actuals.retailActual,
      retailTarget: targets.retailTarget,
      retailCommissionPct: formulaSettings.retailCommissionPct,
    });
    const service = computeServiceCommission({
      serviceActual: actuals.serviceActual,
      serviceTarget: targets.serviceTarget,
      employmentType: employee.employmentType,
      serviceCommissionPct: formulaSettings.serviceCommissionPct,
      freelancerServiceCommissionPct: formulaSettings.freelancerServiceCommissionPct,
    });

    await this.commissionRepo.upsert(
      {
        employeeId: employee.id,
        salonId,
        weekStart,
        retailActual: actuals.retailActual.toFixed(2),
        retailTarget: targets.retailTarget === null ? null : targets.retailTarget.toFixed(2),
        retailTargetReached: retail.targetReached,
        commissionRetail: retail.amount.toFixed(2),
        serviceActual: actuals.serviceActual.toFixed(2),
        serviceTarget: targets.serviceTarget === null ? null : targets.serviceTarget.toFixed(2),
        serviceTargetReached: service.targetReached,
        commissionService: service.amount.toFixed(2),
        totalCommission: (retail.amount + service.amount).toFixed(2),
      },
      ['employeeId', 'salonId', 'weekStart'],
    );

    return actuals;
  }
}
