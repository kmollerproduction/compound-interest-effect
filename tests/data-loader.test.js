import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHistoricalCsv, selectHistoricalPeriod } from "../js/data-loader.js";

const csv = await readFile(new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url), "utf8");
const rows = parseHistoricalCsv(csv);

test("historical source contains the complete validated range", () => {
  assert.equal(rows.length, 240);
  assert.equal(rows[0].month, "2006-10");
  assert.equal(rows.at(-1).month, "2026-09");
});

test("period selection returns exact latest months ending September 2026", () => {
  for (const years of [5, 10, 15, 20]) {
    const selected = selectHistoricalPeriod(rows, years);
    assert.equal(selected.length, years * 12);
    assert.equal(selected.at(-1).month, "2026-09");
    assert.equal(selected[0].month.endsWith("-10"), true);
  }
});
