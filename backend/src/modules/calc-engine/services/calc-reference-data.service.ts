import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormulaSetting, LevelTarget, PerformanceTier, RateCard } from '../../../database/entities';
import { EmployeeLevel } from '../../../database/entities/enums';
import { buildRateCardLookup, RateCardLookup, TierDefinition } from '../domain';

export interface FormulaSettingsValues {
  serviceMultiplier1: number;
  serviceMultiplier2: number;
  retailHourlyRate: number;
  rebookingTargetPct: number;
  treatmentConversionTargetPct: number;
  retailConversionTargetPct: number;
  retailCommissionPct: number;
  serviceCommissionPct: number;
  freelancerServiceCommissionPct: number;
}

// Loads the "slowly changing / HQ-editable" reference data the engine needs
// each run: formula_settings (§6.1/§6.4-§6.8), rate_card (§4.3),
// level_targets (§6.6), performance_tiers (§7.1). Deliberately re-queried on
// every call rather than cached — this data changes rarely (HQ edits) and
// the correctness of always reading the current values outweighs the cost
// of a few extra lookups per recalculation.
@Injectable()
export class CalcReferenceDataService {
  constructor(
    @InjectRepository(FormulaSetting)
    private readonly formulaSettingRepo: Repository<FormulaSetting>,
    @InjectRepository(RateCard) private readonly rateCardRepo: Repository<RateCard>,
    @InjectRepository(LevelTarget) private readonly levelTargetRepo: Repository<LevelTarget>,
    @InjectRepository(PerformanceTier)
    private readonly performanceTierRepo: Repository<PerformanceTier>,
  ) {}

  async loadFormulaSettings(): Promise<FormulaSettingsValues> {
    const rows = await this.formulaSettingRepo.find();
    const byKey = new Map(rows.map((r) => [r.key, parseFloat(r.value)]));
    const get = (key: string): number => {
      const value = byKey.get(key);
      if (value === undefined) {
        throw new Error(`Missing formula_settings entry: ${key}`);
      }
      return value;
    };
    return {
      serviceMultiplier1: get('service_multiplier_1'),
      serviceMultiplier2: get('service_multiplier_2'),
      retailHourlyRate: get('retail_hourly_rate'),
      rebookingTargetPct: get('rebooking_target_pct'),
      treatmentConversionTargetPct: get('treatment_conversion_target_pct'),
      retailConversionTargetPct: get('retail_conversion_target_pct'),
      retailCommissionPct: get('retail_commission_pct'),
      serviceCommissionPct: get('service_commission_pct'),
      freelancerServiceCommissionPct: get('freelancer_service_commission_pct'),
    };
  }

  async loadRateCard(): Promise<RateCardLookup> {
    const rows = await this.rateCardRepo.find();
    return buildRateCardLookup(
      rows.map((r) => ({ level: r.level, dayType: r.dayType, rate: parseFloat(r.rate) })),
    );
  }

  async loadAvgSpendTarget(level: EmployeeLevel): Promise<number> {
    const row = await this.levelTargetRepo.findOneBy({ level });
    if (!row) {
      throw new Error(`Missing level_targets entry for level=${level}`);
    }
    return parseFloat(row.avgSpendTarget);
  }

  async loadPerformanceTiers(): Promise<TierDefinition[]> {
    const rows = await this.performanceTierRepo.find();
    return rows.map((r) => ({ tierNumber: r.tierNumber, thresholdPct: parseFloat(r.thresholdPct) }));
  }
}
