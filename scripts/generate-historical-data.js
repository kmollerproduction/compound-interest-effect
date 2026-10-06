import { readFile, writeFile } from "node:fs/promises";

const marketCsvUrl = new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url);
const marketLines = (await readFile(marketCsvUrl, "utf8")).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
if (marketLines.shift()?.trim() !== "month,return_pct") throw new Error("Unexpected CSV header");
const observations = marketLines.map((line, index) => {
  const [month, rawReturn, ...extra] = line.split(",");
  const returnPct = Number(rawReturn);
  if (extra.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(returnPct)) throw new Error(`Malformed CSV row ${index + 2}`);
  return { month, returnPct };
});
const marketBanner = "// Generated from sixprx_monthly_2006-10_2026-09.csv. Do not edit manually.\n";
const marketBody = `globalThis.SIXPRX_HISTORY = Object.freeze(${JSON.stringify(observations, null, 2)}.map(Object.freeze));\n`;
await writeFile(new URL("../data/sixprx.js", import.meta.url), marketBanner + marketBody, "utf8");

const cpiCsvUrl = new URL("../data/kpi_monthly_2006-10_2026-08.csv", import.meta.url);
const cpiLines = (await readFile(cpiCsvUrl, "utf8")).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
if (cpiLines.shift()?.trim() !== "month,kpi") throw new Error("Unexpected CPI CSV header");
const cpiObservations = cpiLines.map((line, index) => {
  const [month, rawCpi, ...extra] = line.split(",");
  const kpi = Number(rawCpi);
  if (extra.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(kpi) || kpi <= 0) throw new Error(`Malformed CPI CSV row ${index + 2}`);
  return { month, kpi };
});
const cpiBanner = "// Generated from kpi_monthly_2006-10_2026-08.csv. Do not edit manually.\n";
const cpiBody = `globalThis.SWEDISH_CPI_HISTORY = Object.freeze(${JSON.stringify(cpiObservations, null, 2)}.map(Object.freeze));\n`;
await writeFile(new URL("../data/kpi.js", import.meta.url), cpiBanner + cpiBody, "utf8");
