import test from "node:test";
import assert from "node:assert/strict";
import { runSimulation } from "../js/simulation-engine.js";
import { flatHistory, settings } from "./helpers.js";

test("tax is deducted only in December and not in partial final 2026", () => {
  const result = runSimulation(flatHistory(240), settings({ annualTaxPct: 1 }));
  const states = result.portfolios[0].states.slice(1);
  states.forEach((state) => assert.equal(state.tax > 0, state.month.endsWith("-12")));
  assert.equal(states.at(-1).month, "2026-09");
  assert.equal(states.at(-1).tax, 0);
  assert.equal(states.filter((state) => state.tax > 0).at(-1).month, "2025-12");
});

test("first partial year uses 50% of starting capital and Oct-Dec contributions", () => {
  const result = runSimulation(flatHistory(3), settings({ annualTaxPct: 1, monthlySaving: 100 }));
  assert.equal(result.portfolios[0].states.at(-1).taxBase, 500);
  assert.equal(result.portfolios[0].states.at(-1).tax, 5);
  assert.equal(result.portfolios[3].states.at(-1).taxBase, 650);
  assert.equal(result.portfolios[3].states.at(-1).tax, 6.5);
});

test("complete-year tax base uses opening value plus full Jan-Jun and half Jul-Dec contributions", () => {
  const result = runSimulation(flatHistory(15), settings({ annualTaxPct: 1, monthlySaving: 100 }));
  const december2007 = result.portfolios[3].states.find((state) => state.month === "2007-12");
  assert.equal(december2007.taxBase, 1293.5 + 600 + 300);
  assert.equal(december2007.tax, 21.935);
});

test("accumulated tax equals exact deductions", () => {
  const portfolio = runSimulation(flatHistory(40, 1), settings({ annualTaxPct: .35 })).portfolios[0];
  const sum = portfolio.states.reduce((total, state) => total + state.tax, 0);
  assert.equal(sum, portfolio.states.at(-1).cumulativeTax);
});
