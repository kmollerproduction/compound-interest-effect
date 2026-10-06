import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleMonthDomain, getVisibleSeries, getVisibleYDomain } from "../js/graph-domain.js";

function portfolio(values) { return { states: values.map((value) => ({ value })) }; }

test("X-axis reserves 12 months then expands one month at a time", () => {
  assert.equal(getVisibleMonthDomain(1, 240).end, 12);
  assert.equal(getVisibleMonthDomain(12, 240).end, 12);
  assert.equal(getVisibleMonthDomain(13, 240).end, 13);
  assert.equal(getVisibleMonthDomain(24, 240).end, 24);
  assert.equal(getVisibleMonthDomain(240, 240).end, 240);
});

test("no revealed graph history disappears", () => {
  const p = portfolio([100, 110, 90, 140]);
  assert.deepEqual(getVisibleSeries(p, 2), p.states.slice(0, 3));
  assert.deepEqual(getVisibleSeries(p, 3), p.states);
});

test("Y-axis ignores future portfolio values", () => {
  const normal = portfolio([1000, 1010, 1020, 1030]);
  const futureExtreme = portfolio([1000, 990, 980, 1_000_000_000]);
  const atTwo = getVisibleYDomain([normal, futureExtreme], 2);
  assert.ok(atTwo.maximum < 200_000);
  const atThree = getVisibleYDomain([normal, futureExtreme], 3);
  assert.ok(atThree.maximum > 1_000_000_000);
});

test("visible Y-axis includes the fifth portfolio", () => {
  const ordinary = [portfolio([1000, 1100]), portfolio([1000, 1050]), portfolio([1000, 900]), portfolio([1000, 1200])];
  const fifth = portfolio([1000, 5000]);
  const withoutFifth = getVisibleYDomain(ordinary, 1);
  const withFifth = getVisibleYDomain([...ordinary, fifth], 1);
  assert.ok(withFifth.maximum > withoutFifth.maximum);
  assert.ok(withFifth.maximum > 5000);
});
