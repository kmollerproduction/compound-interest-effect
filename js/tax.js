export function contributionTaxWeight(monthNumber) {
  return monthNumber <= 6 ? 1 : 0.5;
}

export function calculateTaxBase({ isFirstSimulationYear, startingCapital, yearStartValue, weightedContributions }) {
  const openingBase = isFirstSimulationYear ? startingCapital * 0.5 : yearStartValue;
  return openingBase + weightedContributions;
}
