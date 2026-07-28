import { EmploymentType } from '../../../database/entities/enums';

export interface CommissionResult {
  amount: number;
  // null = no threshold concept applies (freelancer flat commission, or
  // casual/freelancer with no service_target at all) — not the same as false.
  targetReached: boolean | null;
}

// §6.8 retail — retroactive: once retail_actual >= retail_target, the WHOLE
// amount is commissioned, not just the excess. §4.3 freelancer has no
// retail_target, so its commission is flat with no threshold at all.
export function computeRetailCommission(params: {
  retailActual: number;
  retailTarget: number | null;
  retailCommissionPct: number;
}): CommissionResult {
  const { retailActual, retailTarget, retailCommissionPct } = params;
  const rate = retailCommissionPct / 100;

  if (retailTarget === null) {
    return { amount: retailActual * rate, targetReached: null };
  }
  const reached = retailActual >= retailTarget;
  return { amount: reached ? retailActual * rate : 0, targetReached: reached };
}

// §6.8 service — marginal: only the excess over service_target is
// commissioned. §4.3 overrides: casual gets no service commission at all
// (no target, no commission); freelancer gets a flat 40% of all service
// sales, no threshold.
export function computeServiceCommission(params: {
  serviceActual: number;
  serviceTarget: number | null;
  employmentType: EmploymentType;
  serviceCommissionPct: number;
  freelancerServiceCommissionPct: number;
}): CommissionResult {
  const {
    serviceActual,
    serviceTarget,
    employmentType,
    serviceCommissionPct,
    freelancerServiceCommissionPct,
  } = params;

  if (employmentType === EmploymentType.FREELANCER) {
    return { amount: serviceActual * (freelancerServiceCommissionPct / 100), targetReached: null };
  }
  if (employmentType === EmploymentType.CASUAL || serviceTarget === null) {
    return { amount: 0, targetReached: null };
  }
  const reached = serviceActual >= serviceTarget;
  const amount = reached ? (serviceActual - serviceTarget) * (serviceCommissionPct / 100) : 0;
  return { amount, targetReached: reached };
}
