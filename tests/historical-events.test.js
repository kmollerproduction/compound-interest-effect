import test from "node:test";
import assert from "node:assert/strict";
import { HISTORICAL_EVENTS, getHistoricalEventPosition, getRevealedHistoricalEvents, historicalEventX, placeHistoricalEventBoxes } from "../js/historical-events.js";
import { getVisibleYDomain } from "../js/graph-domain.js";

const history = Array.from({ length: 240 }, (_, index) => {
  const date = new Date(Date.UTC(2006, 9 + index, 1));
  return { month: date.toISOString().slice(0, 7), returnPct: 0 };
});

test("historical events use the approved local-bottom anchor months", () => {
  assert.deepEqual(HISTORICAL_EVENTS.map((event) => event.month), ["2009-01", "2011-09", "2016-01", "2018-12", "2020-03", "2022-09"]);
});

test("events are invisible before their month and remain visible afterwards", () => {
  const event = HISTORICAL_EVENTS[0];
  const eventPosition = getHistoricalEventPosition(event, history);
  assert.equal(getRevealedHistoricalEvents([event], history, eventPosition - .001).length, 0);
  assert.equal(getRevealedHistoricalEvents([event], history, eventPosition).length, 1);
  assert.equal(getRevealedHistoricalEvents([event], history, 240).length, 1);
});

test("event X positions follow the expanding historical domain", () => {
  const eventPosition = getHistoricalEventPosition(HISTORICAL_EVENTS[0], history);
  const initialX = historicalEventX(eventPosition, eventPosition, 70, 1000);
  const finalX = historicalEventX(eventPosition, 240, 70, 1000);
  assert.equal(initialX, 1070);
  assert.ok(finalX < initialX);
  assert.equal(finalX, 70 + (eventPosition / 240) * 1000);
});

test("revealing annotations cannot alter the financial Y-axis domain", () => {
  const portfolios = [{ states: [{ value: 1000 }, { value: 900 }, { value: 1100 }] }];
  const before = getVisibleYDomain(portfolios, 2);
  getRevealedHistoricalEvents(HISTORICAL_EVENTS, history, 240);
  const after = getVisibleYDomain(portfolios, 2);
  assert.deepEqual(after, before);
});

test("annotation lane allocation prevents overlap at compact desktop widths", () => {
  const revealed = getRevealedHistoricalEvents(HISTORICAL_EVENTS, history, 240);
  const placed = placeHistoricalEventBoxes(revealed, { domainEnd: 240, plotLeft: 76, plotWidth: 945, boxWidth: 242 });
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (placed[i].level !== placed[j].level) continue;
      assert.ok(placed[i].boxX + 242 + 8 <= placed[j].boxX || placed[j].boxX + 242 + 8 <= placed[i].boxX);
    }
  }
});
