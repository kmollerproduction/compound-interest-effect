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
    this.plotLayer = null;
    this.eventLayer = null;
    this.labelLayer = null;
    this.eventElements = new Map();
  }

  reset() {
    this.displayDomain = null;
    for (const elements of this.eventElements.values()) {
      elements.state = "hidden";
      elements.layout = null;
      elements.connectorAnimation?.cancel();
      elements.connectorAnimation = null;
      elements.connectorStartLayout = null;
      elements.card.style.transition = "";
      elements.card.style.transform = "";
      elements.group.setAttribute("display", "none");
      elements.group.classList.remove("event-full", "event-compact", "event-morphing");
    }
  }

  ensureLayers() {
    if (!this.plotLayer) {
      this.plotLayer = node("g", { class: "graph-plot" });
      this.eventLayer = node("g", { class: "historical-events" });
      this.labelLayer = node("g", { class: "endpoint-labels" });
    }
    if (this.plotLayer.parentNode !== this.svg) this.svg.replaceChildren(this.plotLayer, this.eventLayer, this.labelLayer);
  }

  getEventElements(event) {
    if (this.eventElements.has(event.month)) return this.eventElements.get(event.month);
    const group = node("g", { class: "historical-event", display: "none" });
    const connector = node("line", { class: "event-connector" });
    const anchor = node("circle", { r: 3, class: "event-anchor" });
    const box = node("rect", { rx: 6, class: "event-box" });
    const title = node("text", { class: "event-title" }, event.title);
    const description = node("text", { class: "event-description" }, event.description);
    const card = node("g", { class: "event-card" });
    card.append(box, title, description);
    group.append(connector, anchor, card);
    const elements = { group, card, connector, anchor, box, title, description, state: "hidden", layout: null, connectorAnimation: null, connectorStartLayout: null };
    card.addEventListener("transitionend", ({ propertyName }) => {
      if (propertyName !== "transform") return;
      group.classList.remove("event-morphing");
      card.style.transition = "";
      card.style.transform = "";
      elements.connectorAnimation?.cancel();
      elements.connectorAnimation = null;
      elements.connectorStartLayout = null;
    });
    this.eventLayer.append(group);
    this.eventElements.set(event.month, elements);
    return elements;
  }

  render(result, position, frozen = false) {
    const width = this.svg.clientWidth || 1200;
    const height = this.svg.clientHeight || 400;
    const margin = { top: 14, right: 170, bottom: 34, left: 76 };
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
    this.ensureLayers();
    this.plotLayer.replaceChildren();
    this.labelLayer.replaceChildren();

    const step = niceStep(yDomain.maximum - yDomain.minimum);
    const firstTick = Math.ceil(yDomain.minimum / step) * step;
    for (let value = firstTick; value <= yDomain.maximum; value += step) {
      const py = y(value);
      this.plotLayer.append(node("line", { x1: margin.left, x2: width - margin.right, y1: py, y2: py, class: "grid-line" }));
      this.plotLayer.append(node("text", { x: margin.left - 10, y: py + 4, "text-anchor": "end", class: "axis-label" }, `${Math.round(value / 1000).toLocaleString("sv-SE")} tkr`));
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
        this.plotLayer.append(node("text", { x: x(i), y: height - 9, "text-anchor": isFirst ? "start" : "middle", class: "axis-label" }, String(isFirst ? startYear : year)));
      }
    }

    const labels = [];
    for (const [portfolioIndex, portfolio] of result.portfolios.entries()) {
      const series = animatedSeries[portfolioIndex];
      const points = series.map((state) => `${x(state.graphPosition)},${y(state.value)}`).join(" ");
      this.plotLayer.append(node("polyline", { points, class: "portfolio-line", stroke: portfolio.definition.color }));
      const end = series.at(-1);
      labels.push({ portfolio, x: x(end.graphPosition) + 9, y: y(end.value) });
    }

    const fullBoxWidth = 520;
    const fullBoxHeight = 82;
    const compactBoxHeight = 42;
    const revealedEvents = getRevealedHistoricalEvents(HISTORICAL_EVENTS, result.history, position).map((event) => {
      if (event.state === "full") return { ...event, boxWidth: fullBoxWidth, boxHeight: fullBoxHeight };
      const probe = node("text", { class: "event-title event-title-compact", visibility: "hidden" }, event.title);
      this.svg.append(probe);
      const boxWidth = Math.ceil(probe.getComputedTextLength()) + 24;
      probe.remove();
      return { ...event, boxWidth, boxHeight: compactBoxHeight };
    });
    const laneGap = 14;
    const laneStep = fullBoxHeight + laneGap;
    const previousLevels = new Map(
      [...this.eventElements.entries()]
        .filter(([, elements]) => Number.isInteger(elements.layout?.level))
        .map(([month, elements]) => [month, elements.layout.level])
    );
    const placedEvents = placeHistoricalEventBoxes(revealedEvents, {
      domainEnd: xDomain.end,
      plotLeft: margin.left,
      plotWidth,
      boxWidth: fullBoxWidth,
      previousLevels
    });
    const visibleEventMonths = new Set(placedEvents.map((event) => event.month));
    for (const [month, elements] of this.eventElements) {
      if (!visibleEventMonths.has(month)) {
        elements.state = "hidden";
        elements.layout = null;
        elements.connectorAnimation?.cancel();
        elements.connectorAnimation = null;
        elements.connectorStartLayout = null;
        elements.card.style.transition = "";
        elements.card.style.transform = "";
        elements.group.setAttribute("display", "none");
        elements.group.classList.remove("event-full", "event-compact", "event-morphing");
      }
    }
    for (const event of placedEvents) {
      const elements = this.getEventElements(event);
      const anchorX = event.anchorX;
      const anchorY = margin.top + plotHeight;
      const boxY = anchorY - 22 - event.boxHeight - event.level * laneStep;
      const boxX = event.boxX;
      const connectorX = Math.max(boxX + 12, Math.min(anchorX, boxX + event.boxWidth - 12));
      const previousLayout = elements.layout;
      const isMorphing = elements.state === "full" && event.state === "compact";
      const isChangingLane = previousLayout && previousLayout.level !== event.level;
      const shouldAnimateLayout = isMorphing || isChangingLane;
      if (shouldAnimateLayout) {
        elements.group.classList.add("event-morphing");
      }
      elements.group.removeAttribute("display");
      elements.group.classList.toggle("event-full", event.state === "full");
      elements.group.classList.toggle("event-compact", event.state === "compact");
      for (const [key, value] of Object.entries({ x1: anchorX, y1: anchorY - 2, x2: connectorX, y2: boxY + event.boxHeight })) elements.connector.setAttribute(key, value);
      elements.anchor.setAttribute("cx", anchorX);
      elements.anchor.setAttribute("cy", anchorY - 2);
      for (const [key, value] of Object.entries({ x: boxX, y: boxY, width: event.boxWidth, height: event.boxHeight })) elements.box.setAttribute(key, value);
      elements.title.setAttribute("x", boxX + (event.state === "full" ? 16 : 12));
      elements.title.setAttribute("y", boxY + (event.state === "full" ? 30 : 27));
      elements.description.setAttribute("x", boxX + 16);
      elements.description.setAttribute("y", boxY + 62);
      const finalLayout = { boxX, boxY, boxWidth: event.boxWidth, boxHeight: event.boxHeight, connectorX, connectorY: boxY + event.boxHeight, level: event.level };
      if (shouldAnimateLayout && previousLayout) {
        const scaleX = previousLayout.boxWidth / finalLayout.boxWidth;
        const scaleY = previousLayout.boxHeight / finalLayout.boxHeight;
        const translateX = previousLayout.boxX - finalLayout.boxX * scaleX;
        const translateY = previousLayout.boxY - finalLayout.boxY * scaleY;
        elements.card.style.transition = "none";
        elements.card.style.transform = `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX}, ${translateY})`;
        elements.card.getBoundingClientRect();
        elements.card.style.transition = "transform 520ms ease-in-out";
        elements.card.style.transform = "matrix(1, 0, 0, 1, 0, 0)";
        elements.connectorAnimation?.cancel();
        elements.connectorAnimation = elements.connector.animate([
          { x2: `${previousLayout.connectorX}px`, y2: `${previousLayout.connectorY}px` },
          { x2: `${finalLayout.connectorX}px`, y2: `${finalLayout.connectorY}px` }
        ], { duration: 520, easing: "ease-in-out" });
        elements.connectorStartLayout = previousLayout;
      } else if (elements.connectorAnimation?.playState === "running") {
        const start = elements.connectorStartLayout;
        elements.connectorAnimation.effect.setKeyframes([
          { x2: `${start.connectorX}px`, y2: `${start.connectorY}px` },
          { x2: `${finalLayout.connectorX}px`, y2: `${finalLayout.connectorY}px` }
        ]);
      }
      elements.state = event.state;
      elements.layout = finalLayout;
    }

    labels.sort((a, b) => a.y - b.y);
    const gap = 20;
    for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + gap);
    const overflow = labels.at(-1).y - (height - margin.bottom);
    if (overflow > 0) labels.forEach((label) => { label.y -= overflow; });
    for (const label of labels) {
      this.labelLayer.append(node("text", { x: Math.min(label.x, width - margin.right + 12), y: label.y + 4, class: "endpoint-label", fill: label.portfolio.definition.color }, label.portfolio.definition.shortName));
    }
  }
}
