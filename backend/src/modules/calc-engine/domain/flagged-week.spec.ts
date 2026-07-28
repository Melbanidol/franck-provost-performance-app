import { hasHoursDeviation } from './flagged-week';

describe('hasHoursDeviation', () => {
  it('is false when scheduled hours exactly match the contract', () => {
    expect(hasHoursDeviation(38, 38)).toBe(false);
  });

  it('flags any deviation, under or over — no tolerance threshold (§6.3)', () => {
    expect(hasHoursDeviation(38, 35)).toBe(true);
    expect(hasHoursDeviation(38, 40)).toBe(true);
    expect(hasHoursDeviation(38, 38.5)).toBe(true);
  });
});
