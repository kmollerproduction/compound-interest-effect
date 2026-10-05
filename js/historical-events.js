export const HISTORICAL_EVENTS = Object.freeze([
  Object.freeze({ month: "2009-01", title: "FINANSKRISEN", description: "Bankkris och global recession", preferredLevel: 0 }),
  Object.freeze({ month: "2011-09", title: "EUROKRISEN", description: "Statsskuldskris och oro för euron", preferredLevel: 1 }),
  Object.freeze({ month: "2016-01", title: "KINA- & RÅVARUORO", description: "Kina, råvarufall och oro för global tillväxt", preferredLevel: 0 }),
  Object.freeze({ month: "2018-12", title: "HANDELSKRIG & RÄNTEORO", description: "USA–Kina och stigande räntor", preferredLevel: 1 }),
  Object.freeze({ month: "2020-03", title: "COVID-19", description: "Pandemi och globala nedstängningar", preferredLevel: 0 }),
  Object.freeze({ month: "2022-09", title: "INFLATION & RÄNTECHOCK", description: "Hög inflation, snabbt stigande räntor och Ukrainakriget", preferredLevel: 1 })
]);

export function getHistoricalEventPosition(event, history) {
  const index = history.findIndex((row) => row.month === event.month);
  return index < 0 ? -1 : index + 1;
}

export function getRevealedHistoricalEvents(events, history, position) {
  return events.map((event) => ({ ...event, position: getHistoricalEventPosition(event, history) }))
    .filter((event) => event.position >= 0 && event.position <= position);
}

export function historicalEventX(position, domainEnd, plotLeft, plotWidth) {
  return plotLeft + (position / domainEnd) * plotWidth;
}

export function placeHistoricalEventBoxes(events, { domainEnd, plotLeft, plotWidth, boxWidth, gap = 8, levelCount = 3 }) {
  const occupied = Array.from({ length: levelCount }, () => []);
  return events.map((event) => {
    const anchorX = historicalEventX(event.position, domainEnd, plotLeft, plotWidth);
    const boxX = Math.max(plotLeft + 4, Math.min(anchorX - boxWidth / 2, plotLeft + plotWidth - boxWidth - 4));
    const preferred = Math.min(levelCount - 1, Math.max(0, event.preferredLevel ?? 0));
    const candidates = [preferred, ...Array.from({ length: levelCount }, (_, index) => index).filter((index) => index !== preferred)];
    const level = candidates.find((candidate) => occupied[candidate].every(({ start, end }) => boxX + boxWidth + gap <= start || boxX >= end + gap)) ?? levelCount - 1;
    occupied[level].push({ start: boxX, end: boxX + boxWidth });
    return { ...event, anchorX, boxX, level };
  });
}
