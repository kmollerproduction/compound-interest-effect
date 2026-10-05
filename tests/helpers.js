export function flatHistory(count, returnPct = 0, startYear = 2006, startMonth = 10) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
    return { month: date.toISOString().slice(0, 7), returnPct };
  });
}

export function settings(overrides = {}) {
  return {
    startingCapital: 1_000,
    periodYears: 20,
    standardFundFeePct: 0,
    originalInsuranceFeePct: 0,
    reducedInsuranceFeePct: 0,
    exposureMultiplier: 1,
    higherExposureFundFeePct: 0,
    monthlySaving: 0,
    annualTaxPct: 0,
    inflationEnabled: false,
    annualInflationPct: 0,
    playbackSeconds20Years: 90,
    ...overrides
  };
}
