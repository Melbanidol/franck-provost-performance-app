import { EmploymentType } from '../../../database/entities/enums';
import { computeRetailTarget, hasRetailTarget } from './retail-target';

describe('hasRetailTarget', () => {
  it('is true for contracted and casual, false for freelancer', () => {
    expect(hasRetailTarget(EmploymentType.CONTRACTED)).toBe(true);
    expect(hasRetailTarget(EmploymentType.CASUAL)).toBe(true);
    expect(hasRetailTarget(EmploymentType.FREELANCER)).toBe(false);
  });
});

describe('computeRetailTarget', () => {
  it('is $14/h × total hours scheduled (§6.4)', () => {
    expect(computeRetailTarget(28, 14)).toBe(392);
  });
});
