import { getVisibleMonthDomain, getYDomainForValues } from "./graph-domain.js";
import { HISTORICAL_EVENTS, getRevealedHistoricalEvents, placeHistoricalEventBoxes } from "./historical-events.js";

const NS = "http://www.w3.org/2000/svg";
function node(name, attributes = {}, text = "") {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.textContent = text;
  return element;
}

function niceStep(span, targetTicks = 5) {
  const rough = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function getAnimatedSeries(portfolio, position) {
  const completed = Math.max(0, Math.min(portfolio.states.length - 1, Math.floor(position)));
  const series = portfolio.states.slice(0, completed + 1).map((state, index) => ({ ...state, graphPosition: index }));
  const fraction = position - completed;
  const next = portfolio.states[completed + 1];
  if (fraction > 0 && next) {
    const current = portfolio.states[completed];
    series.push({ ...next, value: current.value + (next.value - current.value) * fraction, graphPosition: position });
  }
  return series;
}

export class GraphRenderer {
  constructor(svg) {
    this.svg = svg;
    this.displayDomain = null;
  }

  reset() { this.displayDomain = null; }

  render(result, position, frozen = false) {
    const width = this.svg.clientWidth || 1200;
    const height = this.svg.clientHeight || 400;
    const margin = { top: 14, right: 150, bottom: 34, left: 76 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const animatedSeries = result.portfolios.map((portfolio) => getAnimatedSeries(portfolio, position));
    const target = getYDomainForValues(animatedSeries.flatMap((series) => series.map((state) => state.value)));
    if (!this.displayDomain || frozen) this.displayDomain = target;
    if (!frozen) {
      const currentSpan = this.displayDomain.maximum - this.displayDomain.minimum;
      const material = target.minimum < this.displayDomain.minimum + currentSpan * .025 || target.maximum > this.displayDomain.maximum - currentSpan * .025;
      if (material) this.displayDomain = target;
    }
    const yDomain = this.displayDomain;
    const xDomain = getVisibleMonthDomain(position, result.monthCount);
    const x = (index) => margin.left + (index / xDomain.end) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yDomain.minimum) / (yDomain.maximum - yDomain.minimum)) * plotHeight;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.replaceChildren();

    const step = niceStep(yDomain.maximum - yDomain.minimum);
    const firstTick = Math.ceil(yDomain.minimum / step) * step;
    for (let value = firstTick; value <= yDomain.maximum; value += step) {
      const py = y(value);
      this.svg.append(node("line", { x1: margin.left, x2: width - margin.right, y1: py, y2: py, class: "grid-line" }));
      this.svg.append(node("text", { x: margin.left - 10, y: py + 4, "text-anchor": "end", class: "axis-label" }, `${Math.round(value / 1000).toLocaleString("sv-SE")} tkr`));
    }

    const visibleMonths = Math.max(12, xDomain.end);
    const yearInterval = visibleMonths > 180 ? 4 : visibleMonths > 96 ? 2 : 1;
    const startYear = Number(result.history[0].month.slice(0, 4));
    for (let i = 0; i <= visibleMonths; i += 1) {
      const row = result.history[Math.min(result.history.length - 1, Math.max(0, i - 1))];
      if (!row) continue;
      const [year, month] = row.month.split("-").map(Number);
      const isFirst = i === 0;
      if (isFirst || (month === 1 && (year - startYear) % yearInterval === 0)) {
        this.svg.append(node("text", { x: x(i), y: height - 9, "text-anchor": isFirst ? "start" : "middle", class: "axis-label" }, String(isFirst ? startYear : year)));
      }
    }

    const labels = [];
    for (const [portfolioIndex, portfolio] of result.portfolios.entries()) {
      const series = animatedSeries[portfolioIndex];
      const points = series.map((state) => `${x(state.graphPosition)},${y(state.value)}`).join(" ");
      this.svg.append(node("polyline", { points, class: "portfolio-line", stroke: portfolio.definition.color }));
      const end = series.at(-1);
      labels.push({ portfolio, x: x(end.graphPosition) + 9, y: y(end.value) });
    }

    const eventLayer = node("g", { class: "historical-events" });
    const eventBoxWidth = 242;
    const eventBoxHeight = 43;
    const revealedEvents = getRevealedHistoricalEvents(HISTORICAL_EVENTS, result.history, position);
    const placedEvents = placeHistoricalEventBoxes(revealedEvents, { domainEnd: xDomain.end, plotLeft: margin.left, plotWidth, boxWidth: eventBoxWidth });
    for (const event of placedEvents) {
      const anchorX = event.anchorX;
      const anchorY = margin.top + plotHeight;
      const boxY = anchorY - 22 - eventBoxHeight - event.level * 55;
      const boxX = event.boxX;
      const connectorX = Math.max(boxX + 14, Math.min(anchorX, boxX + eventBoxWidth - 14));
      eventLayer.append(node("line", { x1: anchorX, y1: anchorY - 2, x2: connectorX, y2: boxY + eventBoxHeight, class: "event-connector" }));
      eventLayer.append(node("circle", { cx: anchorX, cy: anchorY - 2, r: 3, class: "event-anchor" }));
      eventLayer.append(node("rect", { x: boxX, y: boxY, width: eventBoxWidth, height: eventBoxHeight, rx: 6, class: "event-box" }));
      eventLayer.append(node("text", { x: boxX + 10, y: boxY + 16, class: "event-title" }, event.title));
      eventLayer.append(node("text", { x: boxX + 10, y: boxY + 32, class: "event-description" }, event.description));
    }
    this.svg.append(eventLayer);

    labels.sort((a, b) => a.y - b.y);
    const gap = 16;
    for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + gap);
    const overflow = labels.at(-1).y - (height - margin.bottom);
    if (overflow > 0) labels.forEach((label) => { label.y -= overflow; });
    for (const label of labels) {
      this.svg.append(node("text", { x: Math.min(label.x, width - margin.right + 12), y: label.y + 4, class: "endpoint-label", fill: label.portfolio.definition.color }, label.portfolio.definition.shortName));
    }
  }
}
