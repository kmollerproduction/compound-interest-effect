import test from "node:test";
import assert from "node:assert/strict";
import { HISTORICAL_EVENTS, getHistoricalEventPosition, getHistoricalEventPresentationStates, getRevealedHistoricalEvents, historicalEventX, placeHistoricalEventBoxes } from "../js/historical-events.js";
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

test("only the latest revealed historical event is full", () => {
  const firstPosition = getHistoricalEventPosition(HISTORICAL_EVENTS[0], history);
  const secondPosition = getHistoricalEventPosition(HISTORICAL_EVENTS[1], history);
  const thirdPosition = getHistoricalEventPosition(HISTORICAL_EVENTS[2], history);
  const statesAt = (position) => getHistoricalEventPresentationStates(HISTORICAL_EVENTS, history, position).map((event) => event.state);
  assert.deepEqual(statesAt(firstPosition - 1), ["hidden", "hidden", "hidden", "hidden", "hidden", "hidden"]);
  assert.deepEqual(statesAt(firstPosition), ["full", "hidden", "hidden", "hidden", "hidden", "hidden"]);
  assert.deepEqual(statesAt(secondPosition - 1), ["full", "hidden", "hidden", "hidden", "hidden", "hidden"]);
  assert.deepEqual(statesAt(secondPosition), ["compact", "full", "hidden", "hidden", "hidden", "hidden"]);
  assert.deepEqual(statesAt(thirdPosition), ["compact", "compact", "full", "hidden", "hidden", "hidden"]);
});

test("September 2026 keeps the latest event full and all earlier events compact", () => {
  assert.deepEqual(getHistoricalEventPresentationStates(HISTORICAL_EVENTS, history, 240).map((event) => event.state), ["compact", "compact", "compact", "compact", "compact", "full"]);
});

test("selected 5, 10, 15, and 20 year periods identify the correct latest visible event", () => {
  const expected = new Map([
    [5, ["hidden", "hidden", "hidden", "hidden", "hidden", "full"]],
    [10, ["hidden", "hidden", "hidden", "compact", "compact", "full"]],
    [15, ["hidden", "hidden", "compact", "compact", "compact", "full"]],
    [20, ["compact", "compact", "compact", "compact", "compact", "full"]]
  ]);
  for (const [years, expectedStates] of expected) {
    const selectedHistory = history.slice(-(years * 12));
    assert.deepEqual(getHistoricalEventPresentationStates(HISTORICAL_EVENTS, selectedHistory, selectedHistory.length).map((event) => event.state), expectedStates);
  }
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

test("annotation lane allocation prevents overlap with presentation-sized event boxes", () => {
  const revealed = getRevealedHistoricalEvents(HISTORICAL_EVENTS, history, 240);
  const boxWidth = 520;
  const placed = placeHistoricalEventBoxes(revealed, { domainEnd: 240, plotLeft: 76, plotWidth: 1600, boxWidth });
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (placed[i].level !== placed[j].level) continue;
      assert.ok(placed[i].boxX + boxWidth + 8 <= placed[j].boxX || placed[j].boxX + boxWidth + 8 <= placed[i].boxX);
    }
  }
});

test("annotation placement uses each event's current full or compact width", () => {
  const events = [
    { ...HISTORICAL_EVENTS[0], position: 30, boxWidth: 520 },
    { ...HISTORICAL_EVENTS[1], position: 31, boxWidth: 160 }
  ];
  const placed = placeHistoricalEventBoxes(events, { domainEnd: 60, plotLeft: 76, plotWidth: 1600, boxWidth: 520 });
  assert.equal(placed[0].boxWidth, 520);
  assert.equal(placed[1].boxWidth, 160);
  assert.ok(placed.every((event) => event.boxX >= 80 && event.boxX + event.boxWidth <= 1672));
});

test("annotation placement selects the lowest lane when it is free", () => {
  const placed = placeHistoricalEventBoxes([
    { ...HISTORICAL_EVENTS[0], position: 20, boxWidth: 160 },
    { ...HISTORICAL_EVENTS[1], position: 80, boxWidth: 160 }
  ], { domainEnd: 100, plotLeft: 76, plotWidth: 1000, boxWidth: 520 });
  assert.deepEqual(placed.map((event) => event.level), [0, 0]);
});

test("annotation placement uses the next bottom lane on collision", () => {
  const placed = placeHistoricalEventBoxes([
    { ...HISTORICAL_EVENTS[0], position: 50, boxWidth: 200 },
    { ...HISTORICAL_EVENTS[1], position: 51, boxWidth: 200 }
  ], { domainEnd: 100, plotLeft: 76, plotWidth: 1000, boxWidth: 520 });
  assert.deepEqual(placed.map((event) => event.level), [0, 1]);
});

test("annotation placement retains a previous valid lane", () => {
  const placed = placeHistoricalEventBoxes([
    { ...HISTORICAL_EVENTS[0], position: 20, boxWidth: 160 }
  ], {
    domainEnd: 100,
    plotLeft: 76,
    plotWidth: 1000,
    boxWidth: 520,
    previousLevels: new Map([[HISTORICAL_EVENTS[0].month, 2]])
  });
  assert.equal(placed[0].level, 2);
});

test("adding a non-colliding event does not move an older event from its valid lane", () => {
  const previousLevels = new Map([[HISTORICAL_EVENTS[0].month, 1]]);
  const placed = placeHistoricalEventBoxes([
    { ...HISTORICAL_EVENTS[0], position: 20, boxWidth: 160 },
    { ...HISTORICAL_EVENTS[1], position: 80, boxWidth: 160 }
  ], { domainEnd: 100, plotLeft: 76, plotWidth: 1000, boxWidth: 520, previousLevels });
  assert.deepEqual(placed.map((event) => event.level), [1, 0]);
});

test("an annotation above row two uses free space to the right on row two", () => {
  const events = [
    { month: "a", position: 50, boxWidth: 200 },
    { month: "b", position: 51, boxWidth: 200 },
    { month: "c", position: 52, boxWidth: 200, state: "full" }
  ];
  const placed = placeHistoricalEventBoxes(events, { domainEnd: 100, plotLeft: 0, plotWidth: 1000, boxWidth: 520 });
  assert.deepEqual(placed.map(({ level }) => level), [0, 1, 1]);
  assert.deepEqual(placed.slice(0, 2).map(({ boxX }) => boxX), [400, 410]);
  assert.equal(placed[2].boxX, placed[1].boxX + placed[1].boxWidth + 8);
  assert.ok(placed[2].boxX + placed[2].boxWidth <= 996);
  assert.equal(placed[2].anchorX, 520);
});

test("an annotation keeps its original higher row when row two has insufficient right-side space", () => {
  const events = [
    { month: "a", position: 50, boxWidth: 400 },
    { month: "b", position: 51, boxWidth: 400 },
    { month: "c", position: 52, boxWidth: 400, state: "full" }
  ];
  const placed = placeHistoricalEventBoxes(events, { domainEnd: 100, plotLeft: 0, plotWidth: 1000, boxWidth: 520 });
  assert.deepEqual(placed.map(({ level }) => level), [0, 1, 2]);
  assert.equal(placed[2].boxX, 320);
  assert.equal(placed[2].anchorX, 520);
});
