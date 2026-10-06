import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackController, scaledPlaybackDurationMs } from "../js/playback-controller.js";
import { runSimulation } from "../js/simulation-engine.js";
import { flatHistory, settings } from "./helpers.js";

function controllerHarness() {
  let time = 0;
  let queued;
  const positions = [];
  const controller = new PlaybackController({
    totalMonths: 10,
    durationMs: 1000,
    onFrame: (position) => positions.push(position),
    now: () => time,
    requestFrame: (callback) => { queued = callback; return 1; },
    cancelFrame: () => { queued = undefined; }
  });
  return { controller, positions, setTime: (value) => { time = value; }, tick: () => queued?.(time) };
}

test("playback speed does not alter financial results", () => {
  const history = flatHistory(24, 2);
  const slow = runSimulation(history, settings({ playbackSeconds20Years: 120 }));
  const fast = runSimulation(history, settings({ playbackSeconds20Years: 30 }));
  assert.deepEqual(slow.portfolios.map((p) => p.states.at(-1).value), fast.portfolios.map((p) => p.states.at(-1).value));
  assert.equal(scaledPlaybackDurationMs(10, 90), 45_000);
});

test("pause and resume preserve the exact playback position", () => {
  const h = controllerHarness();
  h.controller.start();
  h.setTime(250); h.tick();
  h.controller.pause();
  assert.equal(h.controller.position, 2);
  h.setTime(750);
  assert.equal(h.controller.position, 2);
  h.controller.resume();
  h.setTime(1000); h.tick();
  assert.equal(h.controller.position, 4.5);
});

test("cancel stops playback and clears the queued animation frame", () => {
  const h = controllerHarness();
  h.controller.start();
  h.setTime(250); h.tick();
  const cancelledAt = h.controller.position;

  h.controller.cancel();
  h.setTime(900); h.tick();

  assert.equal(h.controller.status, "cancelled");
  assert.equal(h.controller.position, cancelledAt);
});
