import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSimulationCpiSeries, calculateRollingInflation, cpiForMonth, inflationAdjustedValue, parseCpiCsv, validateCpiData } from "../js/inflation.js";
import { parseHistoricalCsv, selectHistoricalPeriod } from "../js/data-loader.js";

const cpi = parseCpiCsv(await readFile(new URL("../data/kpi_monthly_2006-10_2026-08.csv", import.meta.url), "utf8"));
const market = parseHistoricalCsv(await readFile(new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url), "utf8"));

test("CPI source contains 239 positive, unique, consecutive observations", () => {
  assert.equal(validateCpiData(cpi), cpi);
  assert.equal(new Set(cpi.map(({ month }) => month)).size, 239);
  assert.ok(cpi.every(({ kpi }) => Number.isFinite(kpi) && kpi > 0));
});

test("CPI validation rejects duplicate, missing, non-numeric, and non-positive observations", () => {
  const duplicate = cpi.map((row) => ({ ...row }));
  duplicate[1].month = duplicate[0].month;
  assert.throws(() => validateCpiData(duplicate), /Duplicate|Missing|out-of-order/);
  assert.throws(() => validateCpiData(cpi.slice(1)), /Expected 239/);
  assert.throws(() => parseCpiCsv("month,kpi\n2006-10,not-a-number"), /Malformed CPI row/);
  assert.throws(() => parseCpiCsv("month,kpi\n2006-10,0"), /Malformed CPI row/);
});

test("historical inflation adjustment uses the CPI index ratio", () => {
  assert.equal(inflationAdjustedValue(1_000_000, 100, 125), 800_000);
  assert.equal(inflationAdjustedValue(1_000_000, 85.16, 85.16), 1_000_000);
});

test("each selected period uses its actual first simulation month CPI", () => {
  const expected = new Map([[5, ["2021-10", 103.13]], [10, ["2016-10", 94.66]], [15, ["2011-10", 93.30]], [20, ["2006-10", 85.16]]]);
  for (const [years, [month, startCpi]] of expected) {
    const series = buildSimulationCpiSeries(cpi, selectHistoricalPeriod(market, years));
    assert.deepEqual(series[0], { month, cpiMonth: month, kpi: startCpi });
  }
});

test("September 2026 explicitly uses the latest available August CPI without adding a source row", () => {
  assert.equal(cpi.at(-1).month, "2026-08");
  assert.equal(cpiForMonth(cpi, "2026-09"), 124.85);
  assert.equal(cpi.some(({ month }) => month === "2026-09"), false);
  assert.deepEqual(buildSimulationCpiSeries(cpi, market).at(-1), { month: "2026-09", cpiMonth: "2026-08", kpi: 124.85 });
});

test("rolling inflation becomes available on the same calendar month after 1, 2, and 3 years", () => {
  const series = buildSimulationCpiSeries(cpi, market);
  const availability = [
    ["2007-09", [false, false, false]], ["2007-10", [true, false, false]],
    ["2008-09", [true, false, false]], ["2008-10", [true, true, false]],
    ["2009-09", [true, true, false]], ["2009-10", [true, true, true]]
  ];
  for (const [month, expected] of availability) {
    const completedMonths = series.findIndex((row) => row.month === month) + 1;
    const rolling = calculateRollingInflation(series, completedMonths);
    assert.deepEqual([12, 24, 36].map((window) => rolling[window] !== null), expected);
  }
});

test("January 2025 rolling inflation compares the same calendar month in prior years", () => {
  const series = buildSimulationCpiSeries(cpi, market);
  const completedMonths = series.findIndex((row) => row.month === "2025-01") + 1;
  const rolling = calculateRollingInflation(series, completedMonths);
  assert.ok(Math.abs(rolling[12] - (124.01 / 122.87 - 1)) < 1e-12);
  assert.ok(Math.abs(rolling[24] - (124.01 / 116.54 - 1)) < 1e-12);
  assert.ok(Math.abs(rolling[36] - (124.01 / 104.36 - 1)) < 1e-12);
});

test("June 2024 rolling inflation uses June 2023 as its one-year comparison", () => {
  const series = buildSimulationCpiSeries(cpi, market);
  const completedMonths = series.findIndex((row) => row.month === "2024-06") + 1;
  assert.ok(Math.abs(calculateRollingInflation(series, completedMonths)[12] - (123.80 / 120.71 - 1)) < 1e-12);
});

test("September 2026 fallback preserves same-month comparisons using effective August CPI", () => {
  const series = buildSimulationCpiSeries(cpi, market);
  const rolling = calculateRollingInflation(series, series.length);
  assert.ok(Math.abs(rolling[12] - (124.85 / 124.47 - 1)) < 1e-12);
  assert.ok(Math.abs(rolling[24] - (124.85 / 123.18 - 1)) < 1e-12);
  assert.ok(Math.abs(rolling[36] - (124.85 / 120.85 - 1)) < 1e-12);
});

test("inflation results depend on completed month, not playback duration or frame timing", () => {
  const series = buildSimulationCpiSeries(cpi, market);
  assert.deepEqual(calculateRollingInflation(series, 24.1), calculateRollingInflation(series, 24.9));
  assert.deepEqual(calculateRollingInflation(series, 24), calculateRollingInflation(series, 24));
});
