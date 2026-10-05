import { readFile } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../js/config.js";
import { parseHistoricalCsv, selectHistoricalPeriod } from "../js/data-loader.js";
import { runSimulation } from "../js/simulation-engine.js";
import { buildAnalysis } from "../js/analysis.js";

const source = await readFile(new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url), "utf8");
const history = selectHistoricalPeriod(parseHistoricalCsv(source), 20);
const result = runSimulation(history, DEFAULT_SETTINGS);
const output = {
  period: `${result.startMonth}–${result.endMonth}`,
  portfolios: Object.fromEntries(result.portfolios.map((portfolio) => {
    const state = portfolio.states.at(-1);
    return [portfolio.definition.id, {
      name: portfolio.definition.name,
      finalValue: state.value,
      fundFees: state.cumulativeFundFees,
      insuranceFees: state.cumulativeInsuranceFees,
      tax: state.cumulativeTax,
      contributions: state.cumulativeContributions
    }];
  })),
  analysis: buildAnalysis(result)
};
console.log(JSON.stringify(output, null, 2));
