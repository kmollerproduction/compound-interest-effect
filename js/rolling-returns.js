export function timeWeightedReturn(factors, months) {
  if (factors.length < months) return null;
  return factors.slice(-months).reduce((product, factor) => product * factor, 1) - 1;
}

export function calculateRollingReturns(factors) {
  return {
    12: timeWeightedReturn(factors, 12),
    24: timeWeightedReturn(factors, 24),
    36: timeWeightedReturn(factors, 36)
  };
}
