export const HISTORICAL_EVENTS = Object.freeze([
  Object.freeze({ month: "2009-01", title: "FINANSKRISEN", description: "Bankkris och global recession", preferredLevel: 0 }),
  Object.freeze({ month: "2011-09", title: "EUROKRISEN", description: "Statsskuldskris och oro för euron", preferredLevel: 1 }),
  Object.freeze({ month: "2016-01", title: "KINA- & RÅVARUORO", description: "Kina, råvarufall och oro för global tillväxt", preferredLevel: 0 }),
  Object.freeze({ month: "2018-12", title: "HANDELSKRIG & RÄNTEORO", description: "USA–Kina och stigande räntor", preferredLevel: 1 }),
  Object.freeze({ month: "2020-03", title: "COVID-19", description: "Pandemi och globala nedstängningar", preferredLevel: 0 }),
  Object.freeze({ month: "2022-09", title: "INFLATION & RÄNTECHOCK", description: "Hög inflation, stigande räntor & Ukrainakriget", preferredLevel: 1 })
]);

export function getHistoricalEventPosition(event, history) {
  const index = history.findIndex((row) => row.month === event.month);
  return index < 0 ? -1 : index + 1;
}

export function getHistoricalEventPresentationStates(events, history, position) {
  const positioned = events.map((event) => ({ ...event, position: getHistoricalEventPosition(event, history) }));
  const revealed = positioned.filter((event) => event.position >= 0 && event.position <= position);
  const latestPosition = revealed.length ? Math.max(...revealed.map((event) => event.position)) : -1;
  return positioned.map((event) => ({
    ...event,
    state: event.position < 0 || event.position > position ? "hidden" : event.position === latestPosition ? "full" : "compact"
  }));
}

export function getRevealedHistoricalEvents(events, history, position) {
  return getHistoricalEventPresentationStates(events, history, position)
    .filter((event) => event.state !== "hidden");
}

export function historicalEventX(position, domainEnd, plotLeft, plotWidth) {
  return plotLeft + (position / domainEnd) * plotWidth;
}

export function placeHistoricalEventBoxes(events, { domainEnd, plotLeft, plotWidth, boxWidth, gap = 8, levelCount = 3, previousLevels = new Map() }) {
  const occupied = Array.from({ length: levelCount }, () => []);
  return events.map((event) => {
    const currentBoxWidth = event.boxWidth ?? boxWidth;
    const anchorX = historicalEventX(event.position, domainEnd, plotLeft, plotWidth);
    const boxX = Math.max(plotLeft + 4, Math.min(anchorX - currentBoxWidth / 2, plotLeft + plotWidth - currentBoxWidth - 4));
    const previous = previousLevels.get(event.month);
    const hasValidPrevious = Number.isInteger(previous) && previous >= 0 && previous < levelCount;
    const candidates = [
      ...(hasValidPrevious ? [previous] : []),
      ...Array.from({ length: levelCount }, (_, index) => index).filter((index) => index !== previous)
    ];
    const level = candidates.find((candidate) => occupied[candidate].every(({ start, end }) => boxX + currentBoxWidth + gap <= start || boxX >= end + gap)) ?? levelCount - 1;
    occupied[level].push({ start: boxX, end: boxX + currentBoxWidth });
    return { ...event, anchorX, boxX, boxWidth: currentBoxWidth, level };
  });
}
