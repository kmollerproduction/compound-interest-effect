import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHistoricalCsv, validateHistoricalData } from "../js/data-loader.js";

await import("../data/sixprx.js");
const csv = await readFile(new URL("../data/sixprx_monthly_2006-10_2026-09.csv", import.meta.url), "utf8");
const authoritative = parseHistoricalCsv(csv);
const runtime = globalThis.SIXPRX_HISTORY;

test("runtime history is exactly identical to the authoritative CSV", () => {
  assert.equal(runtime.length, 240);
  assert.equal(runtime[0].month, "2006-10");
  assert.equal(runtime.at(-1).month, "2026-09");
  validateHistoricalData(runtime);
  assert.deepEqual(runtime.map(({ month, returnPct }) => ({ month, returnPct })), authoritative);
});
