import test from "node:test";
import assert from "node:assert/strict";
import { runSimulation } from "../js/simulation-engine.js";
import { buildAnalysis } from "../js/analysis.js";
import { flatHistory, settings } from "./helpers.js";

test("analysis compares every isolated decision and the combined decision with the common reference", () => {
  const result = runSimulation(flatHistory(24, 1), settings({ originalInsuranceFeePct: .65, exposureMultiplier: 1.4, higherExposureFundFeePct: 1, monthlySaving: 100 }));
  const analysis = buildAnalysis(result);
  const finals = result.portfolios.map((p) => p.states.at(-1));
  assert.equal(analysis.insuranceDecision.finalValueEffect, finals[1].value - finals[0].value);
  assert.equal(analysis.higherExposureDecision.finalValueEffect, finals[2].value - finals[0].value);
  assert.equal(analysis.savingDecision.finalValueEffect, finals[3].value - finals[0].value);
  assert.equal(analysis.savingDecision.returnGenerated, finals[3].value - finals[0].value - finals[3].cumulativeContributions);
  assert.equal(analysis.combinedDecision.finalValueEffect, finals[4].value - finals[0].value);
  const isolatedSum = analysis.insuranceDecision.finalValueEffect + analysis.higherExposureDecision.finalValueEffect + analysis.savingDecision.finalValueEffect;
  assert.notEqual(isolatedSum, analysis.combinedDecision.finalValueEffect);
});
