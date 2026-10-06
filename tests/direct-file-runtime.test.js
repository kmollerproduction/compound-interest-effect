import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const bundle = await readFile(new URL("../js/app.bundle.js", import.meta.url), "utf8");

test("browser entrypoint uses ordered classic local scripts compatible with file URLs", () => {
  const dataPosition = index.indexOf('<script src="data/sixprx.js"></script>');
  const cpiPosition = index.indexOf('<script src="data/kpi.js"></script>');
  const appPosition = index.indexOf('<script src="js/app.bundle.js"></script>');
  assert.ok(dataPosition > 0);
  assert.ok(cpiPosition > dataPosition);
  assert.ok(appPosition > cpiPosition);
  assert.equal(index.includes('type="module"'), false);
  assert.equal(bundle.includes("fetch("), false);
});

test("browser bundle replaces the loading screen with a Swedish error on initialization failure", () => {
  assert.match(bundle, /Den historiska SIXPRX-datan saknas/);
  assert.match(bundle, /Den historiska KPI-datan saknas/);
  assert.match(bundle, /Kontrollera att programmets filer är kompletta/);
  assert.match(bundle, /showScreen\("error-screen"\)/);
});

test("inflation toggle controls all historical-inflation presentation elements", () => {
  assert.match(index, /id="inflation-indicator"/);
  assert.equal(index.includes('name="annualInflationPct"'), false);
  assert.match(index, /Visa inflation/);
  assert.match(index, /Historisk KPI, SCB/);
  assert.match(bundle, /inflationIndicator\.classList\.toggle\("hidden", !settings\.inflationEnabled\)/);
  assert.match(bundle, /inflation\.classList\.toggle\("hidden", !settings\.inflationEnabled\)/);
  assert.match(bundle, /settings\.inflationEnabled \? `<p class="summary-inflation"/);
});
