import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeLevelHistory } from '../../../database/entities';
import { EmployeeLevel } from '../../../database/entities/enums';

// §6.6 — "si un coiffeur change de niveau, l'objectif doit être recalculé à
// partir de la date du changement (historiser le niveau, ne pas juste
// écraser la valeur courante)". Resolves whichever level was effective on a
// given date from employee_level_history; falls back to the employee's
// current level when there's no history row yet (i.e. never changed).
@Injectable()
export class LevelResolutionService {
  constructor(
    @InjectRepository(EmployeeLevelHistory)
    private readonly historyRepo: Repository<EmployeeLevelHistory>,
  ) {}

  async resolveLevelAt(employee: Employee, date: string): Promise<EmployeeLevel> {
    const row = await this.historyRepo
      .createQueryBuilder('h')
      .where('h.employee_id = :employeeId', { employeeId: employee.id })
      .andWhere('h.effective_from <= :date', { date })
      .andWhere('(h.effective_to IS NULL OR h.effective_to >= :date)', { date })
      .getOne();

    return row ? row.level : employee.level;
  }
}
