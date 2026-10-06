export const DEFAULT_SETTINGS = Object.freeze({
  startingCapital: 1_000_000,
  periodYears: 20,
  standardFundFeePct: 0.30,
  originalInsuranceFeePct: 0.65,
  reducedInsuranceFeePct: 0,
  exposureMultiplier: 1.4,
  higherExposureFundFeePct: 1.00,
  monthlySaving: 2_000,
  annualTaxPct: 0.35,
  inflationEnabled: true,
  annualInflationPct: 2.0,
  playbackSeconds20Years: 90
});

export const PORTFOLIO_META = Object.freeze([
  { id: "reference", name: "Gör ingenting", shortName: "Gör ingenting", color: "#4769e8" },
  { id: "lowerFee", name: "Sänk avgiften", shortName: "Sänk avgiften", color: "#9a5ce5" },
  { id: "higherExposure", name: "Högre exponering", shortName: "Högre exponering", color: "#e29935" },
  { id: "monthlySaving", name: "Månadsspara", shortName: "Månadsspara", color: "#18a7a1" },
  { id: "allThree", name: "Alla tre", shortName: "Alla tre", color: "#cf5b91" }
]);

export function validateSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const positive = ["startingCapital", "periodYears", "playbackSeconds20Years"];
  for (const key of positive) {
    if (!Number.isFinite(settings[key]) || settings[key] <= 0) throw new Error(`${key} must be positive`);
  }
  if (![5, 10, 15, 20].includes(settings.periodYears)) throw new Error("periodYears must be 5, 10, 15, or 20");
  const nonNegative = ["standardFundFeePct", "originalInsuranceFeePct", "reducedInsuranceFeePct", "higherExposureFundFeePct", "monthlySaving", "annualTaxPct", "annualInflationPct"];
  for (const key of nonNegative) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0) throw new Error(`${key} must be non-negative`);
  }
  if (!Number.isFinite(settings.exposureMultiplier) || settings.exposureMultiplier <= 0) throw new Error("exposureMultiplier must be positive");
  return settings;
}
