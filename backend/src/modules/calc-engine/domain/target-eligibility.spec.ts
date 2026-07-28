import { EmploymentType } from '../../../database/entities/enums';
import { hasAnyTargets } from './target-eligibility';

describe('hasAnyTargets', () => {
  it('is false only for freelancer', () => {
    expect(hasAnyTargets(EmploymentType.CONTRACTED)).toBe(true);
    expect(hasAnyTargets(EmploymentType.CASUAL)).toBe(true);
    expect(hasAnyTargets(EmploymentType.FREELANCER)).toBe(false);
  });
});
