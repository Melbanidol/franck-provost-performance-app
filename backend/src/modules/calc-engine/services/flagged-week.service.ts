import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, FlaggedWeek } from '../../../database/entities';
import { EmploymentType, FlaggedWeekStatus } from '../../../database/entities/enums';
import { hasHoursDeviation } from '../domain';

// §6.3 — only contracted employees have contracted hours to deviate from
// (enforced at the DB level: contracted_hours_per_week is null for anyone
// else). Only ever creates/updates a row while it's still 'pending': once a
// manager has marked a week 'reviewed', a later recompute (e.g. the roster
// gets edited again) leaves it alone rather than silently resetting their
// review.
@Injectable()
export class FlaggedWeekService {
  constructor(
    @InjectRepository(FlaggedWeek) private readonly repo: Repository<FlaggedWeek>,
  ) {}

  async upsertForEmployee(params: {
    employee: Employee;
    weekStart: string;
    totalScheduledHours: number;
  }): Promise<void> {
    const { employee, weekStart, totalScheduledHours } = params;

    if (employee.employmentType !== EmploymentType.CONTRACTED || employee.contractedHoursPerWeek === null) {
      return;
    }

    const contractedHours = parseFloat(employee.contractedHoursPerWeek);
    if (!hasHoursDeviation(contractedHours, totalScheduledHours)) {
      return;
    }

    const existing = await this.repo.findOneBy({ employeeId: employee.id, weekStart });
    if (existing && existing.status === FlaggedWeekStatus.REVIEWED) {
      return;
    }

    await this.repo.upsert(
      {
        employeeId: employee.id,
        weekStart,
        contractedHours: contractedHours.toFixed(2),
        scheduledHours: totalScheduledHours.toFixed(2),
        status: FlaggedWeekStatus.PENDING,
      },
      ['employeeId', 'weekStart'],
    );
  }
}
