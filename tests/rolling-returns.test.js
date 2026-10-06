import test from "node:test";
import assert from "node:assert/strict";
import { runSimulation } from "../js/simulation-engine.js";
import { flatHistory, settings } from "./helpers.js";

test("contributions do not artificially increase rolling return", () => {
  const result = runSimulation(flatHistory(12), settings({ monthlySaving: 100 }));
  assert.ok(Math.abs(result.portfolios[3].states.at(-1).rollingReturns[12]) < 1e-12);
  assert.ok(Math.abs(result.portfolios[4].states.at(-1).rollingReturns[12]) < 1e-12);
});

test("fund fees reduce rolling return", () => {
  const result = runSimulation(flatHistory(12), settings({ higherExposureFundFeePct: 1 }));
  assert.ok(result.portfolios[2].states.at(-1).rollingReturns[12] < 0);
});

test("insurance fees reduce rolling return", () => {
  const result = runSimulation(flatHistory(12), settings({ originalInsuranceFeePct: 1 }));
  assert.ok(result.portfolios[0].states.at(-1).rollingReturns[12] < 0);
});

test("tax reduces rolling return", () => {
  const result = runSimulation(flatHistory(12), settings({ annualTaxPct: 1 }));
  assert.ok(result.portfolios[0].states.at(-1).rollingReturns[12] < 0);
});

test("rolling-return availability follows exact elapsed-month boundaries for all five portfolios", () => {
  const result = runSimulation(flatHistory(37, 1), settings({ monthlySaving: 100 }));
  const boundaries = [
    { month: 1, available: [] },
    { month: 11, available: [] },
    { month: 12, available: [12] },
    { month: 13, available: [12] },
    { month: 23, available: [12] },
    { month: 24, available: [12, 24] },
    { month: 25, available: [12, 24] },
    { month: 35, available: [12, 24] },
    { month: 36, available: [12, 24, 36] },
    { month: 37, available: [12, 24, 36] }
  ];

  for (const portfolio of result.portfolios) {
    for (const { month, available } of boundaries) {
      for (const window of [12, 24, 36]) {
        const value = portfolio.states[month].rollingReturns[window];
        assert.equal(value === null, !available.includes(window), `${portfolio.definition.id}: month ${month}, ${window}-month window`);
      }
    }
  }
});

test("rolling returns use only the latest 12, 24 and 36 monthly factors for every portfolio", () => {
  const history = flatHistory(37).map((row, index) => ({ ...row, returnPct: (index % 7) - 3 }));
  const result = runSimulation(history, settings({ exposureMultiplier: 1.4, monthlySaving: 100 }));
  const checkpoints = [12, 13, 24, 25, 36, 37];

  for (const [portfolioIndex, portfolio] of result.portfolios.entries()) {
    const exposure = [1, 1, 1.4, 1, 1.4][portfolioIndex];
    const expectedFactors = history.map((row) => 1 + (row.returnPct / 100) * exposure);
    for (const month of checkpoints) {
      for (const window of [12, 24, 36]) {
        const actual = portfolio.states[month].rollingReturns[window];
        if (month < window) {
          assert.equal(actual, null);
          continue;
        }
        const expected = expectedFactors.slice(month - window, month).reduce((product, factor) => product * factor, 1) - 1;
        assert.ok(Math.abs(actual - expected) < 1e-12, `${portfolio.definition.id}: month ${month}, ${window}-month window`);
      }
    }
  }
});

test("first rolling returns are anchored to the October 2006 simulation start", () => {
  const result = runSimulation(flatHistory(36, 1), settings());
  assert.equal(result.portfolios[0].states[12].month, "2007-09");
  assert.notEqual(result.portfolios[0].states[12].rollingReturns[12], null);
  assert.equal(result.portfolios[0].states[24].month, "2008-09");
  assert.notEqual(result.portfolios[0].states[24].rollingReturns[24], null);
  assert.equal(result.portfolios[0].states[36].month, "2009-09");
  assert.notEqual(result.portfolios[0].states[36].rollingReturns[36], null);
});
