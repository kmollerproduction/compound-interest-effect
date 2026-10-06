import test from "node:test";
import assert from "node:assert/strict";
import { runSimulation, annualPctToMonthlyRate, buildPortfolioDefinitions } from "../js/simulation-engine.js";
import { flatHistory, settings } from "./helpers.js";

test("all portfolios have identical starting values", () => {
  const result = runSimulation(flatHistory(3), settings());
  assert.deepEqual(result.portfolios.map((p) => p.states[0].value), [1000, 1000, 1000, 1000, 1000]);
});

test("five portfolio definitions isolate the three decisions and combine them only in portfolio 5", () => {
  const configured = settings({ standardFundFeePct: .3, originalInsuranceFeePct: .65, reducedInsuranceFeePct: 0, exposureMultiplier: 1.4, higherExposureFundFeePct: 1, monthlySaving: 200 });
  const definitions = buildPortfolioDefinitions(configured);
  assert.deepEqual(definitions.map(({ exposure, fundFeePct, insuranceFeePct, monthlyContribution }) => ({ exposure, fundFeePct, insuranceFeePct, monthlyContribution })), [
    { exposure: 1, fundFeePct: .3, insuranceFeePct: .65, monthlyContribution: 0 },
    { exposure: 1, fundFeePct: .3, insuranceFeePct: 0, monthlyContribution: 0 },
    { exposure: 1.4, fundFeePct: 1, insuranceFeePct: .65, monthlyContribution: 0 },
    { exposure: 1, fundFeePct: .3, insuranceFeePct: .65, monthlyContribution: 200 },
    { exposure: 1.4, fundFeePct: 1, insuranceFeePct: 0, monthlyContribution: 200 }
  ]);
  assert.deepEqual(definitions.map(({ hasMonthlyContributions }) => hasMonthlyContributions), [false, false, false, true, true]);
});

test("all portfolios match when differences are disabled", () => {
  const result = runSimulation(flatHistory(24, 2), settings());
  const finals = result.portfolios.map((p) => p.states.at(-1).value);
  finals.forEach((value) => assert.equal(value, finals[0]));
});

test("portfolio 1 and 2 match with equal insurance fees", () => {
  const result = runSimulation(flatHistory(24, 1), settings({ originalInsuranceFeePct: .65, reducedInsuranceFeePct: .65 }));
  assert.equal(result.portfolios[0].states.at(-1).value, result.portfolios[1].states.at(-1).value);
});

test("1.4x exposure applies exactly 1.4 times each monthly percentage return before fees", () => {
  const history = [{ month: "2006-10", returnPct: 5 }, { month: "2006-11", returnPct: -10 }];
  const result = runSimulation(history, settings({ exposureMultiplier: 1.4 }));
  assert.ok(Math.abs(result.portfolios[2].states[1].marketReturn - .07) < 1e-15);
  assert.ok(Math.abs(result.portfolios[2].states[2].marketReturn - -.14) < 1e-15);
});

test("monthly contribution is added before the market return", () => {
  const result = runSimulation(flatHistory(1, 10), settings({ exposureMultiplier: 1, monthlySaving: 100 }));
  assert.equal(result.portfolios[3].states[1].value, 1210);
  assert.equal(result.portfolios[4].states[1].value, 1210);
});

test("effective annual fees use equivalent monthly rates and tracked totals equal deductions", () => {
  const result = runSimulation(flatHistory(12), settings({ standardFundFeePct: 12, originalInsuranceFeePct: 12 }));
  const portfolio = result.portfolios[0];
  const monthlyRate = annualPctToMonthlyRate(12);
  assert.ok(Math.abs(monthlyRate - ((1.12 ** (1 / 12)) - 1)) < 1e-15);
  assert.equal(portfolio.states.reduce((sum, state) => sum + state.fundFee, 0), portfolio.states.at(-1).cumulativeFundFees);
  assert.equal(portfolio.states.reduce((sum, state) => sum + state.insuranceFee, 0), portfolio.states.at(-1).cumulativeInsuranceFees);
});

test("contribution totals equal exact deposits", () => {
  const result = runSimulation(flatHistory(17), settings({ monthlySaving: 200 }));
  assert.equal(result.portfolios[3].states.at(-1).cumulativeContributions, 3400);
  assert.equal(result.portfolios[4].states.at(-1).cumulativeContributions, 3400);
});
