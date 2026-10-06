import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../js/config.js";
import { parseHistoricalCsv } from "../js/data-loader.js";
import { runSimulation } from "../js/simulation-engine.js";

const history = parseHistoricalCsv(await readFile(new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url), "utf8"));
const result = runSimulation(history, DEFAULT_SETTINGS);

test("historical CPI presentation leaves all nominal default results and deductions unchanged", () => {
  const expected = [
    [5_126_334, 139_293, 301_243, 143_633, 0],
    [5_838_366, 151_592, 0, 155_208, 0],
    [8_038_997, 603_534, 392_597, 182_050, 0],
    [6_574_974, 170_048, 367_758, 174_752, 480_000],
    [11_507_674, 804_479, 0, 240_267, 480_000]
  ];
  assert.deepEqual(result.portfolios.map(({ states }) => {
    const final = states.at(-1);
    return [final.value, final.cumulativeFundFees, final.cumulativeInsuranceFees, final.cumulativeTax, final.cumulativeContributions].map(Math.round);
  }), expected);
});
