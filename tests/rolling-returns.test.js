import test from "node:test";
import assert from "node:assert/strict";
import { runSimulation } from "../js/simulation-engine.js";
import { flatHistory, settings } from "./helpers.js";

test("contributions do not artificially increase rolling return", () => {
  const result = runSimulation(flatHistory(12), settings({ monthlySaving: 100 }));
  assert.ok(Math.abs(result.portfolios[3].states.at(-1).rollingReturns[12]) < 1e-12);
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

test("12, 24 and 36 month returns appear only with enough history", () => {
  const result = runSimulation(flatHistory(36, 1), settings());
  assert.equal(result.portfolios[0].states[11].rollingReturns[12], null);
  assert.notEqual(result.portfolios[0].states[12].rollingReturns[12], null);
  assert.equal(result.portfolios[0].states[23].rollingReturns[24], null);
  assert.notEqual(result.portfolios[0].states[24].rollingReturns[24], null);
  assert.equal(result.portfolios[0].states[35].rollingReturns[36], null);
  assert.notEqual(result.portfolios[0].states[36].rollingReturns[36], null);
});
