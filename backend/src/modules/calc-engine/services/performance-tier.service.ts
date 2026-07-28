import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeePerformanceTier } from '../../../database/entities';
import { computeOverperformancePct, resolveTierReached, TierDefinition } from '../domain';

// §7.1 — only meaningful when there's a service_target to overperform
// against (employment_type = 'contracted', §4.3). For casual/freelancer
// there is nothing to compute: any previously-stored row for this
// employee/salon/week is removed so a recompute after an employment_type
// change doesn't leave a stale tier behind.
@Injectable()
export class PerformanceTierService {
  constructor(
    @InjectRepository(EmployeePerformanceTier)
    private readonly repo: Repository<EmployeePerformanceTier>,
  ) {}

  async upsertForSalon(params: {
    employeeId: string;
    salonId: string;
    weekStart: string;
    serviceActual: number;
    serviceTarget: number | null;
    tiers: TierDefinition[];
  }): Promise<void> {
    const { employeeId, salonId, weekStart, serviceActual, serviceTarget, tiers } = params;
    const overperformancePct = computeOverperformancePct(serviceActual, serviceTarget);

    if (overperformancePct === null) {
      await this.repo.delete({ employeeId, salonId, weekStart });
      return;
    }

    const tierReached = resolveTierReached(overperformancePct, tiers);
    await this.repo.upsert(
      {
        employeeId,
        salonId,
        weekStart,
        overperformancePct: overperformancePct.toFixed(2),
        tierReached,
      },
      ['employeeId', 'salonId', 'weekStart'],
    );
  }
}
