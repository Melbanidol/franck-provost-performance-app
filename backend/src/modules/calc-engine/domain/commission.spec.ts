import { EmploymentType } from '../../../database/entities/enums';
import { computeRetailCommission, computeServiceCommission } from './commission';

describe('computeRetailCommission', () => {
  it('pays nothing below target', () => {
    const result = computeRetailCommission({ retailActual: 300, retailTarget: 400, retailCommissionPct: 20 });
    expect(result).toEqual({ amount: 0, targetReached: false });
  });

  it('pays 20% of the FULL amount once target is reached — retroactive, not marginal (§6.8)', () => {
    const result = computeRetailCommission({ retailActual: 500, retailTarget: 400, retailCommissionPct: 20 });
    expect(result).toEqual({ amount: 100, targetReached: true });
  });

  it('is flat with no threshold for freelancer (retail_target = null, §4.3)', () => {
    const result = computeRetailCommission({ retailActual: 500, retailTarget: null, retailCommissionPct: 20 });
    expect(result).toEqual({ amount: 100, targetReached: null });
  });
});

describe('computeServiceCommission', () => {
  it('contracted: pays nothing below target', () => {
    const result = computeServiceCommission({
      serviceActual: 3000,
      serviceTarget: 3252.96,
      employmentType: EmploymentType.CONTRACTED,
      serviceCommissionPct: 30,
      freelancerServiceCommissionPct: 40,
    });
    expect(result).toEqual({ amount: 0, targetReached: false });
  });

  it('contracted: pays 30% of only the excess above target — marginal, not retroactive (§6.8)', () => {
    const result = computeServiceCommission({
      serviceActual: 4000,
      serviceTarget: 3252.96,
      employmentType: EmploymentType.CONTRACTED,
      serviceCommissionPct: 30,
      freelancerServiceCommissionPct: 40,
    });
    // (4000 - 3252.96) * 0.3 = 224.112
    expect(result.targetReached).toBe(true);
    expect(result.amount).toBeCloseTo(224.112, 6);
  });

  it('casual: never gets a service commission, regardless of actuals (§4.3)', () => {
    const result = computeServiceCommission({
      serviceActual: 10000,
      serviceTarget: null,
      employmentType: EmploymentType.CASUAL,
      serviceCommissionPct: 30,
      freelancerServiceCommissionPct: 40,
    });
    expect(result).toEqual({ amount: 0, targetReached: null });
  });

  it('freelancer: flat 40% of all service sales, no threshold at all (§4.3)', () => {
    const result = computeServiceCommission({
      serviceActual: 5000,
      serviceTarget: null,
      employmentType: EmploymentType.FREELANCER,
      serviceCommissionPct: 30,
      freelancerServiceCommissionPct: 40,
    });
    expect(result).toEqual({ amount: 2000, targetReached: null });
  });
});
