import { readFile, writeFile } from "node:fs/promises";

const csvUrl = new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url);
const outputUrl = new URL("../data/sixprx.js", import.meta.url);
const lines = (await readFile(csvUrl, "utf8")).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
if (lines.shift()?.trim() !== "month,return_pct") throw new Error("Unexpected CSV header");
const observations = lines.map((line, index) => {
  const [month, rawReturn, ...extra] = line.split(",");
  const returnPct = Number(rawReturn);
  if (extra.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(returnPct)) throw new Error(`Malformed CSV row ${index + 2}`);
  return { month, returnPct };
});
const banner = "// Generated from sixprx_monthly_2006-10_2026-09.csv. Do not edit manually.\n";
const body = `globalThis.SIXPRX_HISTORY = Object.freeze(${JSON.stringify(observations, null, 2)}.map(Object.freeze));\n`;
await writeFile(outputUrl, banner + body, "utf8");
