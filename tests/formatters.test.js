import test from "node:test";
import assert from "node:assert/strict";
import { rollingReturnClass } from "../js/formatters.js";

test("rolling return colors distinguish positive, negative, zero and unavailable values", () => {
  assert.equal(rollingReturnClass(0.000001), "positive");
  assert.equal(rollingReturnClass(-0.000001), "negative");
  assert.equal(rollingReturnClass(0), "neutral");
  assert.equal(rollingReturnClass(null), "neutral");
  assert.equal(rollingReturnClass(undefined), "neutral");
});
