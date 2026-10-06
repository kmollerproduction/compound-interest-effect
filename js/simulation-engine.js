import { PORTFOLIO_META, validateSettings } from "./config.js";
import { calculateRollingReturns } from "./rolling-returns.js";
import { calculateTaxBase, contributionTaxWeight } from "./tax.js";

export function annualPctToMonthlyRate(annualPct) {
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

export function buildPortfolioDefinitions(settings) {
  const financialDefinitions = {
    reference: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    lowerFee: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.reducedInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    higherExposure: { exposure: settings.exposureMultiplier, fundFeePct: settings.higherExposureFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    monthlySaving: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: settings.monthlySaving, hasMonthlyContributions: true },
    allThree: { exposure: settings.exposureMultiplier, fundFeePct: settings.higherExposureFundFeePct, insuranceFeePct: settings.reducedInsuranceFeePct, monthlyContribution: settings.monthlySaving, hasMonthlyContributions: true }
  };
  return PORTFOLIO_META.map((meta) => ({ ...meta, ...financialDefinitions[meta.id] }));
}

function createInitialState(definition, startingCapital) {
  return {
    month: null,
    value: startingCapital,
    contribution: 0,
    marketReturn: 0,
    fundFee: 0,
    insuranceFee: 0,
    tax: 0,
    taxBase: 0,
    cumulativeFundFees: 0,
    cumulativeInsuranceFees: 0,
    cumulativeTax: 0,
    cumulativeContributions: 0,
    rollingReturns: { 12: null, 24: null, 36: null },
    definition
  };
}

function simulatePortfolio(definition, history, settings) {
  const states = [createInitialState(definition, settings.startingCapital)];
  const factors = [];
  const fundRate = annualPctToMonthlyRate(definition.fundFeePct);
  const insuranceRate = annualPctToMonthlyRate(definition.insuranceFeePct);
  const taxRate = settings.annualTaxPct / 100;
  const firstYear = Number(history[0].month.slice(0, 4));
  let value = settings.startingCapital;
  let currentYear = firstYear;
  let yearStartValue = settings.startingCapital;
  let weightedContributions = 0;
  let cumulativeFundFees = 0;
  let cumulativeInsuranceFees = 0;
  let cumulativeTax = 0;
  let cumulativeContributions = 0;

  for (const row of history) {
    const [year, monthNumber] = row.month.split("-").map(Number);
    if (year !== currentYear) {
      currentYear = year;
      yearStartValue = value;
      weightedContributions = 0;
    }

    const contribution = definition.monthlyContribution;
    value += contribution;
    cumulativeContributions += contribution;
    weightedContributions += contribution * contributionTaxWeight(monthNumber);
    const performanceOpeningValue = value;

    const marketReturn = (row.returnPct / 100) * definition.exposure;
    value *= 1 + marketReturn;

    const fundFee = value * fundRate;
    value -= fundFee;
    cumulativeFundFees += fundFee;

    const insuranceFee = value * insuranceRate;
    value -= insuranceFee;
    cumulativeInsuranceFees += insuranceFee;

    let taxBase = 0;
    let tax = 0;
    if (monthNumber === 12) {
      taxBase = calculateTaxBase({
        isFirstSimulationYear: year === firstYear,
        startingCapital: settings.startingCapital,
        yearStartValue,
        weightedContributions
      });
      tax = taxBase * taxRate;
      value -= tax;
      cumulativeTax += tax;
    }

    factors.push(performanceOpeningValue === 0 ? 1 : value / performanceOpeningValue);
    states.push({
      month: row.month,
      value,
      contribution,
      marketReturn,
      fundFee,
      insuranceFee,
      tax,
      taxBase,
      cumulativeFundFees,
      cumulativeInsuranceFees,
      cumulativeTax,
      cumulativeContributions,
      rollingReturns: calculateRollingReturns(factors),
      definition
    });
  }

  return { definition, states, performanceFactors: factors };
}

export function runSimulation(history, inputSettings = {}) {
  const settings = validateSettings(inputSettings);
  const portfolios = buildPortfolioDefinitions(settings).map((definition) => simulatePortfolio(definition, history, settings));
  return {
    settings,
    history,
    portfolios,
    monthCount: history.length,
    startMonth: history[0].month,
    endMonth: history.at(-1).month
  };
}
