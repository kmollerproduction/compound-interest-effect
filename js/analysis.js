export function buildAnalysis(result) {
  const [p1, p2, p3, p4, p5] = result.portfolios.map((portfolio) => portfolio.states.at(-1));
  const totalContributions = p4.cumulativeContributions;
  const savingEffect = p4.value - p1.value;
  return {
    insuranceDecision: {
      finalValueEffect: p2.value - p1.value,
      insuranceFeesAvoided: p1.cumulativeInsuranceFees - p2.cumulativeInsuranceFees
    },
    higherExposureDecision: {
      finalValueEffect: p3.value - p1.value,
      portfolio1FundFees: p1.cumulativeFundFees,
      portfolio3FundFees: p3.cumulativeFundFees
    },
    savingDecision: {
      finalValueEffect: savingEffect,
      totalContributions,
      returnGenerated: savingEffect - totalContributions
    },
    combinedDecision: {
      finalValueEffect: p5.value - p1.value
    }
  };
}
