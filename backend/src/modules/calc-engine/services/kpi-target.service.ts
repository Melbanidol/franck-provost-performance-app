import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyTarget, Employee, KpiTarget } from '../../../database/entities';
import { EmployeeLevel } from '../../../database/entities/enums';
import {
  allocateWeeklyTargetToDays,
  computeDailyRetailTarget,
  computeRetailTarget,
  computeServiceTarget,
  computeWeightedWageForSalon,
  hasRetailTarget,
  hasServiceTarget,
  RateCardLookup,
  resolveHourlyRate,
} from '../domain';
import { FormulaSettingsValues } from './calc-reference-data.service';
import { RosterDay } from './roster-week.service';

export interface SalonWeeklyTargets {
  serviceTarget: number | null;
  retailTarget: number | null;
}

// §6.1/§6.2/§6.4/§6.6/§6.7/§6.10 — computes and persists the weekly
// kpi_targets row and the daily_targets breakdown for one employee, in one
// salon, for one week.
@Injectable()
export class KpiTargetService {
  constructor(
    @InjectRepository(KpiTarget) private readonly kpiTargetRepo: Repository<KpiTarget>,
    @InjectRepository(DailyTarget) private readonly dailyTargetRepo: Repository<DailyTarget>,
  ) {}

  async upsertForSalon(params: {
    employee: Employee;
    levelAtWeek: EmployeeLevel;
    salonId: string;
    isPrimarySalon: boolean;
    weekStart: string;
    days: RosterDay[];
    rateCard: RateCardLookup;
    formulaSettings: FormulaSettingsValues;
    avgSpendTarget: number;
  }): Promise<SalonWeeklyTargets> {
    const {
      employee,
      levelAtWeek,
      salonId,
      isPrimarySalon,
      weekStart,
      days,
      rateCard,
      formulaSettings,
      avgSpendTarget,
    } = params;

    const totalHours = days.reduce((sum, d) => sum + d.hoursScheduled, 0);

    const serviceTarget = hasServiceTarget(employee.employmentType)
      ? computeServiceTarget(
          computeWeightedWageForSalon({
            dailyHours: days,
            employmentType: employee.employmentType,
            level: levelAtWeek,
            isPrimarySalon,
            rateCard,
          }),
          formulaSettings.serviceMultiplier1,
          formulaSettings.serviceMultiplier2,
        )
      : null;

    const retailTarget = hasRetailTarget(employee.employmentType)
      ? computeRetailTarget(totalHours, formulaSettings.retailHourlyRate)
      : null;

    await this.kpiTargetRepo.upsert(
      {
        employeeId: employee.id,
        salonId,
        weekStart,
        serviceTarget: serviceTarget === null ? null : serviceTarget.toFixed(2),
        retailTarget: retailTarget === null ? null : retailTarget.toFixed(2),
        rebookingTarget: formulaSettings.rebookingTargetPct.toFixed(2),
        avgSpendTarget: avgSpendTarget.toFixed(2),
        treatmentConversionTarget: formulaSettings.treatmentConversionTargetPct.toFixed(2),
        retailConversionTarget: formulaSettings.retailConversionTargetPct.toFixed(2),
      },
      ['employeeId', 'salonId', 'weekStart'],
    );

    await this.upsertDailyTargets({
      employee,
      levelAtWeek,
      salonId,
      isPrimarySalon,
      weekStart,
      days,
      rateCard,
      formulaSettings,
      serviceTarget,
      retailTarget,
    });

    return { serviceTarget, retailTarget };
  }

  private async upsertDailyTargets(params: {
    employee: Employee;
    levelAtWeek: EmployeeLevel;
    salonId: string;
    isPrimarySalon: boolean;
    weekStart: string;
    days: RosterDay[];
    rateCard: RateCardLookup;
    formulaSettings: FormulaSettingsValues;
    serviceTarget: number | null;
    retailTarget: number | null;
  }): Promise<void> {
    const {
      employee,
      levelAtWeek,
      salonId,
      isPrimarySalon,
      weekStart,
      days,
      rateCard,
      formulaSettings,
      serviceTarget,
      retailTarget,
    } = params;

    // heures_planifiées(jour) × taux_horaire(type_de_jour), §6.2
    const weightedDays = days.map((day) => {
      const rate = resolveHourlyRate({
        employmentType: employee.employmentType,
        level: levelAtWeek,
        isPrimarySalon,
        dayType: day.dayType,
        rateCard,
      });
      return { date: day.date, weightedHours: rate === null ? 0 : day.hoursScheduled * rate };
    });

    const dailyServiceAllocation =
      serviceTarget === null
        ? new Map<string, number>()
        : allocateWeeklyTargetToDays(serviceTarget, weightedDays);

    for (const day of days) {
      const dailyService = serviceTarget === null ? null : (dailyServiceAllocation.get(day.date) ?? 0);
      const dailyRetail =
        retailTarget === null
          ? null
          : computeDailyRetailTarget(day.hoursScheduled, formulaSettings.retailHourlyRate);
      const weightedHours = weightedDays.find((w) => w.date === day.date)?.weightedHours ?? 0;

      await this.dailyTargetRepo.upsert(
        {
          employeeId: employee.id,
          salonId,
          date: day.date,
          dayType: day.dayType,
          hoursScheduled: day.hoursScheduled.toFixed(2),
          weightedHours: weightedHours.toFixed(4),
          dailyServiceTarget: dailyService === null ? null : dailyService.toFixed(2),
          dailyRetailTarget: dailyRetail === null ? null : dailyRetail.toFixed(2),
          weekStart,
        },
        ['employeeId', 'salonId', 'date'],
      );
    }
  }
}
