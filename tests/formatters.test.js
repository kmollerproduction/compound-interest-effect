import test from "node:test";
import assert from "node:assert/strict";
import { inflationAdjustedValue, rollingReturnClass } from "../js/formatters.js";

test("rolling return colors distinguish positive, negative, zero and unavailable values", () => {
  assert.equal(rollingReturnClass(0.000001), "positive");
  assert.equal(rollingReturnClass(-0.000001), "negative");
  assert.equal(rollingReturnClass(0), "neutral");
  assert.equal(rollingReturnClass(null), "neutral");
  assert.equal(rollingReturnClass(undefined), "neutral");
});

test("inflation adjustment discounts only by elapsed time and the configured annual rate", () => {
  assert.ok(Math.abs(inflationAdjustedValue(1_210_000, 10, 24) - 1_000_000) < 1e-9);
  assert.equal(inflationAdjustedValue(1_000_000, 2, 0), 1_000_000);
});
