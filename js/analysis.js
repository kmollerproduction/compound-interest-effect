export function buildAnalysis(result) {
  const [p1, p2, p3, p4] = result.portfolios.map((portfolio) => portfolio.states.at(-1));
  const totalContributions = p4.cumulativeContributions;
  const savingEffect = p4.value - p3.value;
  return {
    insuranceDecision: {
      finalValueEffect: p2.value - p1.value,
      insuranceFeesAvoided: p1.cumulativeInsuranceFees - p2.cumulativeInsuranceFees
    },
    higherExposureDecision: {
      finalValueEffect: p3.value - p2.value,
      portfolio2FundFees: p2.cumulativeFundFees,
      portfolio3FundFees: p3.cumulativeFundFees
    },
    savingDecision: {
      finalValueEffect: savingEffect,
      totalContributions,
      returnGenerated: savingEffect - totalContributions
    }
  };
}
