// Generated from modular source files by scripts/build-browser-bundle.js. Do not edit manually.
(() => {
"use strict";

// ---- config.js ----
const DEFAULT_SETTINGS = Object.freeze({
  startingCapital: 1_000_000,
  periodYears: 20,
  standardFundFeePct: 0.30,
  originalInsuranceFeePct: 0.65,
  reducedInsuranceFeePct: 0,
  exposureMultiplier: 1.4,
  higherExposureFundFeePct: 1.00,
  monthlySaving: 2_000,
  annualTaxPct: 0.35,
  inflationEnabled: true,
  playbackSeconds20Years: 90
});

const PORTFOLIO_META = Object.freeze([
  { id: "reference", name: "Gör ingenting", shortName: "Gör ingenting", color: "#4769e8" },
  { id: "lowerFee", name: "Sänk avgiften", shortName: "Sänk avgiften", color: "#9a5ce5" },
  { id: "higherExposure", name: "Högre exponering", shortName: "Högre exponering", color: "#e29935" },
  { id: "monthlySaving", name: "Månadsspara", shortName: "Månadsspara", color: "#18a7a1" },
  { id: "allThree", name: "Alla tre", shortName: "Alla tre", color: "#cf5b91" }
]);

function validateSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const positive = ["startingCapital", "periodYears", "playbackSeconds20Years"];
  for (const key of positive) {
    if (!Number.isFinite(settings[key]) || settings[key] <= 0) throw new Error(`${key} must be positive`);
  }
  if (![5, 10, 15, 20].includes(settings.periodYears)) throw new Error("periodYears must be 5, 10, 15, or 20");
  const nonNegative = ["standardFundFeePct", "originalInsuranceFeePct", "reducedInsuranceFeePct", "higherExposureFundFeePct", "monthlySaving", "annualTaxPct"];
  for (const key of nonNegative) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0) throw new Error(`${key} must be non-negative`);
  }
  if (!Number.isFinite(settings.exposureMultiplier) || settings.exposureMultiplier <= 0) throw new Error("exposureMultiplier must be positive");
  return settings;
}


// ---- data-loader.js ----
function parseHistoricalCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.shift()?.trim() !== "month,return_pct") throw new Error("Unexpected historical data header");
  const rows = lines.map((line, index) => {
    const [month, rawReturn, ...extra] = line.split(",");
    const returnPct = Number(rawReturn);
    if (extra.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(returnPct)) {
      throw new Error(`Malformed historical row ${index + 2}`);
    }
    return { month, returnPct };
  });
  validateHistoricalData(rows);
  return rows;
}

function validateHistoricalData(rows) {
  if (rows.length !== 240) throw new Error(`Expected 240 historical rows, received ${rows.length}`);
  if (rows[0].month !== "2006-10" || rows.at(-1).month !== "2026-09") throw new Error("Unexpected historical range");
  for (let i = 1; i < rows.length; i += 1) {
    const [year, month] = rows[i - 1].month.split("-").map(Number);
    const expected = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    if (rows[i].month !== expected) throw new Error(`Missing or out-of-order month before ${rows[i].month}`);
  }
  return rows;
}

function selectHistoricalPeriod(rows, years) {
  if (![5, 10, 15, 20].includes(years)) throw new Error("Unsupported period");
  const selected = rows.slice(-(years * 12));
  if (selected.length !== years * 12 || selected.at(-1)?.month !== "2026-09") throw new Error("Historical period unavailable");
  return selected;
}


// ---- inflation.js ----
const CPI_FIRST_MONTH = "2006-10";
const CPI_LAST_MONTH = "2026-08";
const CPI_OBSERVATION_COUNT = 239;

function parseCpiCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.shift()?.trim() !== "month,kpi") throw new Error("Unexpected CPI data header");
  const rows = lines.map((line, index) => {
    const [month, rawCpi, ...extra] = line.split(",");
    const kpi = Number(rawCpi);
    if (extra.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || rawCpi === "" || !Number.isFinite(kpi) || kpi <= 0) {
      throw new Error(`Malformed CPI row ${index + 2}`);
    }
    return { month, kpi };
  });
  validateCpiData(rows);
  return rows;
}

function validateCpiData(rows) {
  if (!Array.isArray(rows) || rows.length !== CPI_OBSERVATION_COUNT) {
    throw new Error(`Expected ${CPI_OBSERVATION_COUNT} CPI rows, received ${rows?.length ?? 0}`);
  }
  if (rows[0]?.month !== CPI_FIRST_MONTH || rows.at(-1)?.month !== CPI_LAST_MONTH) throw new Error("Unexpected CPI range");
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !Number.isFinite(row.kpi) || row.kpi <= 0) {
      throw new Error(`Invalid CPI observation at index ${index}`);
    }
    if (seen.has(row.month)) throw new Error(`Duplicate CPI month ${row.month}`);
    seen.add(row.month);
    if (index > 0) {
      const [year, month] = rows[index - 1].month.split("-").map(Number);
      const expected = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
      if (row.month !== expected) throw new Error(`Missing or out-of-order CPI month before ${row.month}`);
    }
  });
  return rows;
}

function cpiObservationForMonth(rows, month) {
  const exact = rows.find((row) => row.month === month);
  if (exact) return exact;
  if (month > rows.at(-1).month) return rows.at(-1);
  throw new Error(`CPI unavailable for ${month}`);
}

function cpiForMonth(rows, month) {
  return cpiObservationForMonth(rows, month).kpi;
}

function buildSimulationCpiSeries(rows, marketHistory) {
  validateCpiData(rows);
  return marketHistory.map(({ month }) => {
    const observation = cpiObservationForMonth(rows, month);
    return { month, cpiMonth: observation.month, kpi: observation.kpi };
  });
}

function inflationAdjustedValue(nominalValue, startCpi, currentCpi) {
  if (![nominalValue, startCpi, currentCpi].every(Number.isFinite) || startCpi <= 0 || currentCpi <= 0) {
    throw new Error("Invalid value for CPI adjustment");
  }
  return nominalValue * startCpi / currentCpi;
}

function calculateRollingInflation(cpiSeries, completedMonths) {
  const count = Math.min(cpiSeries.length, Math.max(0, Math.floor(completedMonths)));
  if (count === 0) return { 12: null, 24: null, 36: null };
  const current = cpiSeries[count - 1];
  const effectiveMonth = current.cpiMonth ?? current.month;
  const [currentYear, currentMonth] = effectiveMonth.split("-").map(Number);
  const byMonth = new Map(cpiSeries.slice(0, count).map((row) => [row.month, row.kpi]));
  const simulationStartMonth = cpiSeries[0].month;
  return Object.fromEntries([12, 24, 36].map((windowMonths) => {
    const comparisonMonth = `${currentYear - windowMonths / 12}-${String(currentMonth).padStart(2, "0")}`;
    const comparisonCpi = comparisonMonth >= simulationStartMonth ? byMonth.get(comparisonMonth) : undefined;
    return [windowMonths, comparisonCpi === undefined ? null : current.kpi / comparisonCpi - 1];
  }));
}


// ---- rolling-returns.js ----
function timeWeightedReturn(factors, months) {
  if (factors.length < months) return null;
  return factors.slice(-months).reduce((product, factor) => product * factor, 1) - 1;
}

function calculateRollingReturns(factors) {
  return {
    12: timeWeightedReturn(factors, 12),
    24: timeWeightedReturn(factors, 24),
    36: timeWeightedReturn(factors, 36)
  };
}


// ---- tax.js ----
function contributionTaxWeight(monthNumber) {
  return monthNumber <= 6 ? 1 : 0.5;
}

function calculateTaxBase({ isFirstSimulationYear, startingCapital, yearStartValue, weightedContributions }) {
  const openingBase = isFirstSimulationYear ? startingCapital * 0.5 : yearStartValue;
  return openingBase + weightedContributions;
}


// ---- simulation-engine.js ----
function annualPctToMonthlyRate(annualPct) {
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

function buildPortfolioDefinitions(settings) {
  const financialDefinitions = {
    reference: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    lowerFee: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.reducedInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    higherExposure: { exposure: settings.exposureMultiplier, fundFeePct: settings.higherExposureFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: 0, hasMonthlyContributions: false },
    monthlySaving: { exposure: 1, fundFeePct: settings.standardFundFeePct, insuranceFeePct: settings.originalInsuranceFeePct, monthlyContribution: settings.monthlySaving, hasMonthlyContributions: true },
    allThree: { exposure: settings.exposureMultiplier, fundFeePct: settings.higherExposureFundFeePct, insuranceFeePct: settings.reducedInsuranceFeePct, monthlyContribution: settings.monthlySaving, hasMonthlyContributions: true }
  };
  return PORTFOLIO_META.map((meta) => ({ ...meta, ...financialDefinitions[meta.id] }));
}

function createInitialState(definition, startingCapital) {
  return {
    month: null,
    value: startingCapital,
    contribution: 0,
    marketReturn: 0,
    fundFee: 0,
    insuranceFee: 0,
    tax: 0,
    taxBase: 0,
    cumulativeFundFees: 0,
    cumulativeInsuranceFees: 0,
    cumulativeTax: 0,
    cumulativeContributions: 0,
    rollingReturns: { 12: null, 24: null, 36: null },
    definition
  };
}

function simulatePortfolio(definition, history, settings) {
  const states = [createInitialState(definition, settings.startingCapital)];
  const factors = [];
  const fundRate = annualPctToMonthlyRate(definition.fundFeePct);
  const insuranceRate = annualPctToMonthlyRate(definition.insuranceFeePct);
  const taxRate = settings.annualTaxPct / 100;
  const firstYear = Number(history[0].month.slice(0, 4));
  let value = settings.startingCapital;
  let currentYear = firstYear;
  let yearStartValue = settings.startingCapital;
  let weightedContributions = 0;
  let cumulativeFundFees = 0;
  let cumulativeInsuranceFees = 0;
  let cumulativeTax = 0;
  let cumulativeContributions = 0;

  for (const row of history) {
    const [year, monthNumber] = row.month.split("-").map(Number);
    if (year !== currentYear) {
      currentYear = year;
      yearStartValue = value;
      weightedContributions = 0;
    }

    const contribution = definition.monthlyContribution;
    value += contribution;
    cumulativeContributions += contribution;
    weightedContributions += contribution * contributionTaxWeight(monthNumber);
    const performanceOpeningValue = value;

    const marketReturn = (row.returnPct / 100) * definition.exposure;
    value *= 1 + marketReturn;

    const fundFee = value * fundRate;
    value -= fundFee;
    cumulativeFundFees += fundFee;

    const insuranceFee = value * insuranceRate;
    value -= insuranceFee;
    cumulativeInsuranceFees += insuranceFee;

    let taxBase = 0;
    let tax = 0;
    if (monthNumber === 12) {
      taxBase = calculateTaxBase({
        isFirstSimulationYear: year === firstYear,
        startingCapital: settings.startingCapital,
        yearStartValue,
        weightedContributions
      });
      tax = taxBase * taxRate;
      value -= tax;
      cumulativeTax += tax;
    }

    factors.push(performanceOpeningValue === 0 ? 1 : value / performanceOpeningValue);
    states.push({
      month: row.month,
      value,
      contribution,
      marketReturn,
      fundFee,
      insuranceFee,
      tax,
      taxBase,
      cumulativeFundFees,
      cumulativeInsuranceFees,
      cumulativeTax,
      cumulativeContributions,
      rollingReturns: calculateRollingReturns(factors),
      definition
    });
  }

  return { definition, states, performanceFactors: factors };
}

function runSimulation(history, inputSettings = {}) {
  const settings = validateSettings(inputSettings);
  const portfolios = buildPortfolioDefinitions(settings).map((definition) => simulatePortfolio(definition, history, settings));
  return {
    settings,
    history,
    portfolios,
    monthCount: history.length,
    startMonth: history[0].month,
    endMonth: history.at(-1).month
  };
}


// ---- analysis.js ----
function buildAnalysis(result) {
  const [p1, p2, p3, p4, p5] = result.portfolios.map((portfolio) => portfolio.states.at(-1));
  const totalContributions = p4.cumulativeContributions;
  const savingEffect = p4.value - p1.value;
  return {
    insuranceDecision: {
      finalValueEffect: p2.value - p1.value,
      insuranceFeesAvoided: p1.cumulativeInsuranceFees - p2.cumulativeInsuranceFees
    },
    higherExposureDecision: {
      finalValueEffect: p3.value - p1.value,
      portfolio1FundFees: p1.cumulativeFundFees,
      portfolio3FundFees: p3.cumulativeFundFees
    },
    savingDecision: {
      finalValueEffect: savingEffect,
      totalContributions,
      returnGenerated: savingEffect - totalContributions
    },
    combinedDecision: {
      finalValueEffect: p5.value - p1.value
    }
  };
}


// ---- graph-domain.js ----
function getVisibleMonthDomain(position, totalMonths) {
  return { start: 0, end: Math.min(totalMonths, Math.max(12, position)) };
}

function getVisibleSeries(portfolio, position) {
  const completed = Math.max(0, Math.min(portfolio.states.length - 1, Math.floor(position)));
  return portfolio.states.slice(0, completed + 1);
}

function getVisibleYDomain(portfolios, position, paddingRatio = 0.1) {
  const values = portfolios.flatMap((portfolio) => getVisibleSeries(portfolio, position).map((state) => state.value));
  return getYDomainForValues(values, paddingRatio);
}

function getYDomainForValues(values, paddingRatio = 0.1) {
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const minimumSpan = Math.max(100_000, maximum * 0.1);
  if (maximum - minimum < minimumSpan) {
    const middle = (minimum + maximum) / 2;
    minimum = middle - minimumSpan / 2;
    maximum = middle + minimumSpan / 2;
  }
  const padding = (maximum - minimum) * paddingRatio;
  return { minimum: Math.max(0, minimum - padding), maximum: maximum + padding };
}


// ---- historical-events.js ----
const HISTORICAL_EVENTS = Object.freeze([
  Object.freeze({ month: "2009-01", title: "FINANSKRISEN", description: "Bankkris och global recession", preferredLevel: 0 }),
  Object.freeze({ month: "2011-09", title: "EUROKRISEN", description: "Statsskuldskris och oro för euron", preferredLevel: 1 }),
  Object.freeze({ month: "2016-01", title: "KINA- & RÅVARUORO", description: "Kina, råvarufall och oro för global tillväxt", preferredLevel: 0 }),
  Object.freeze({ month: "2018-12", title: "HANDELSKRIG & RÄNTEORO", description: "USA–Kina och stigande räntor", preferredLevel: 1 }),
  Object.freeze({ month: "2020-03", title: "COVID-19", description: "Pandemi och globala nedstängningar", preferredLevel: 0 }),
  Object.freeze({ month: "2022-09", title: "INFLATION & RÄNTECHOCK", description: "Hög inflation, stigande räntor & Ukrainakriget", preferredLevel: 1 })
]);

function getHistoricalEventPosition(event, history) {
  const index = history.findIndex((row) => row.month === event.month);
  return index < 0 ? -1 : index + 1;
}

function getHistoricalEventPresentationStates(events, history, position) {
  const positioned = events.map((event) => ({ ...event, position: getHistoricalEventPosition(event, history) }));
  const revealed = positioned.filter((event) => event.position >= 0 && event.position <= position);
  const latestPosition = revealed.length ? Math.max(...revealed.map((event) => event.position)) : -1;
  return positioned.map((event) => ({
    ...event,
    state: event.position < 0 || event.position > position ? "hidden" : event.position === latestPosition ? "full" : "compact"
  }));
}

function getRevealedHistoricalEvents(events, history, position) {
  return getHistoricalEventPresentationStates(events, history, position)
    .filter((event) => event.state !== "hidden");
}

function historicalEventX(position, domainEnd, plotLeft, plotWidth) {
  return plotLeft + (position / domainEnd) * plotWidth;
}

function placeHistoricalEventBoxes(events, { domainEnd, plotLeft, plotWidth, boxWidth, gap = 8, levelCount = 3, previousLevels = new Map() }) {
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


// ---- playback-controller.js ----
function scaledPlaybackDurationMs(periodYears, secondsFor20Years) {
  return secondsFor20Years * 1000 * (periodYears / 20);
}

class PlaybackController {
  constructor({ totalMonths, durationMs, onFrame, onComplete, now = () => performance.now(), requestFrame = (callback) => requestAnimationFrame(callback), cancelFrame = (id) => cancelAnimationFrame(id) }) {
    this.totalMonths = totalMonths;
    this.durationMs = durationMs;
    this.onFrame = onFrame;
    this.onComplete = onComplete;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.position = 0;
    this.status = "idle";
    this.frameId = null;
    this.anchorTime = 0;
    this.anchorPosition = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    this.stopFrame();
    this.position = 0;
    this.anchorPosition = 0;
    this.status = "running";
    this.anchorTime = this.now();
    this.onFrame(this.position, this.status);
    this.frameId = this.requestFrame(this.tick);
  }

  pause() {
    if (this.status !== "running") return;
    this.updatePosition(this.now());
    this.position = Math.floor(this.position);
    this.status = "paused";
    this.stopFrame();
    this.onFrame(this.position, this.status);
  }

  resume() {
    if (this.status !== "paused") return;
    this.anchorPosition = this.position;
    this.anchorTime = this.now();
    this.status = "running";
    this.frameId = this.requestFrame(this.tick);
  }

  cancel() {
    if (this.status === "cancelled") return;
    this.stopFrame();
    this.status = "cancelled";
  }

  updatePosition(timestamp) {
    const elapsed = timestamp - this.anchorTime;
    this.position = Math.min(this.totalMonths, this.anchorPosition + (elapsed / this.durationMs) * this.totalMonths);
  }

  tick(timestamp) {
    if (this.status !== "running") return;
    this.updatePosition(timestamp);
    if (this.position >= this.totalMonths) {
      this.position = this.totalMonths;
      this.status = "complete";
      this.frameId = null;
      this.onFrame(this.position, this.status);
      this.onComplete?.();
      return;
    }
    this.onFrame(this.position, this.status);
    this.frameId = this.requestFrame(this.tick);
  }

  stopFrame() {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
  }
}


// ---- formatters.js ----
const currencyFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" });

function formatCurrency(value, signed = false) {
  const rounded = Math.round(value);
  const sign = signed && rounded > 0 ? "+" : signed && rounded < 0 ? "−" : "";
  return `${sign}${currencyFormatter.format(Math.abs(rounded))} kr`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  const percentage = value * 100;
  const sign = percentage > 0 ? "+" : percentage < 0 ? "−" : "";
  return `${sign}${percentFormatter.format(Math.abs(percentage))} %`;
}

function formatMonth(month) {
  if (!month) return "Start";
  const [year, monthNumber] = month.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(year, monthNumber - 1, 1))).toLocaleUpperCase("sv-SE");
}

function valueClass(value) {
  return value > 0.5 ? "positive" : value < -0.5 ? "negative" : "neutral";
}

function rollingReturnClass(value) {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}


// ---- graph-renderer.js ----
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

class GraphRenderer {
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


// ---- app.js ----
const screens = [...document.querySelectorAll(".screen")];
const form = document.querySelector("#settings-form");
const graph = new GraphRenderer(document.querySelector("#portfolio-chart"));
let allHistory;
let allCpiHistory;
let simulationCpi;
let settings = { ...DEFAULT_SETTINGS };
let result;
let playback;
let previousScreen = "start-screen";
const settingPercentFormatter = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactPercentFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
const multiplierFormatter = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function settingPercent(value) { return `${settingPercentFormatter.format(value)} %`; }
function compactSettingPercent(value) { return `${compactPercentFormatter.format(value)} %`; }
function settingMultiplier(value) { return `${multiplierFormatter.format(value)}×`; }
function monthlyAmount(value) { return `${formatCurrency(value).replace(/ kr$/, "")} kr/mån`; }

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
}

function rebuild() {
  const selected = selectHistoricalPeriod(allHistory, settings.periodYears);
  simulationCpi = buildSimulationCpiSeries(allCpiHistory, selected);
  result = runSimulation(selected, settings);
  renderStart();
  renderCards();
  renderAnalysis();
  graph.reset();
}

function renderStart() {
  document.querySelector("#start-period").textContent = `${result.startMonth} – ${result.endMonth} · ${settings.periodYears} år`;
  document.querySelector("#start-capital").textContent = formatCurrency(settings.startingCapital);
  const [reference, lowerFee, higherExposure, monthlySaving, allThree] = result.portfolios.map((portfolio) => portfolio.definition);
  const cards = [
    {
      definition: reference,
      fact: `${Math.round(reference.exposure * 100)} % SIXPRX`,
      description: "Svenskt aktieindex inklusive återinvesterade utdelningar.",
      details: [`Fondavgift: ${settingPercent(reference.fundFeePct)}`, `Försäkringsavgift: ${settingPercent(reference.insuranceFeePct)}`]
    },
    {
      definition: lowerFee,
      fact: `${compactSettingPercent(lowerFee.insuranceFeePct)} försäkringsavgift`,
      description: `Samma investering som referensen, men försäkringsavgiften sänks från ${settingPercent(reference.insuranceFeePct)} till ${compactSettingPercent(lowerFee.insuranceFeePct)}.`,
      details: [`Marknadsexponering: ${settingMultiplier(lowerFee.exposure)}`, `Fondavgift: ${settingPercent(lowerFee.fundFeePct)}`]
    },
    {
      definition: higherExposure,
      fact: `${settingMultiplier(higherExposure.exposure)} marknadsexponering`,
      description: `Högre exponering mot samma marknad. Fondavgiften ökar samtidigt från ${settingPercent(reference.fundFeePct)} till ${settingPercent(higherExposure.fundFeePct)}.`,
      details: [`Försäkringsavgift: ${settingPercent(higherExposure.insuranceFeePct)}`]
    },
    {
      definition: monthlySaving,
      fact: monthlyAmount(monthlySaving.monthlyContribution),
      description: `Samma investering och avgifter som referensen, med ett löpande sparande på ${formatCurrency(monthlySaving.monthlyContribution)} per månad.`,
      details: [`Fondavgift: ${settingPercent(monthlySaving.fundFeePct)}`, `Försäkringsavgift: ${settingPercent(monthlySaving.insuranceFeePct)}`]
    },
    {
      definition: allThree,
      fact: "Alla tre beslut",
      description: "Kombinerar sänkt försäkringsavgift, högre marknadsexponering och löpande månadssparande.",
      details: [`${settingMultiplier(allThree.exposure)} · ${monthlyAmount(allThree.monthlyContribution)}`, `Fondavgift: ${settingPercent(allThree.fundFeePct)} · Försäkring: ${settingPercent(allThree.insuranceFeePct)}`]
    }
  ];
  document.querySelector("#start-portfolios").innerHTML = cards.map(({ definition, fact, description, details }) => `
    <article class="start-portfolio-card" style="--portfolio-color:${definition.color}">
      <h2>${definition.name}</h2>
      <div class="start-portfolio-fact">${fact}</div>
      <p class="start-portfolio-description">${description}</p>
      <div class="start-portfolio-details">${details.map((detail) => `<span>${detail}</span>`).join("")}</div>
    </article>`).join("");
}

function renderCards() {
  document.querySelector("#portfolio-grid").innerHTML = result.portfolios.map((portfolio, index) => `
    <article class="portfolio-card" style="--portfolio-color:${portfolio.definition.color}" data-portfolio="${portfolio.definition.id}">
      <h3>${portfolio.definition.name}</h3>
      <div class="portfolio-value">${formatCurrency(settings.startingCapital)}</div>
      <div class="inflation-value"></div>
      <div class="difference neutral">${index === 0 ? "Referens" : "0 kr mot referens"}</div>
      <p class="rolling-title">${portfolio.definition.hasMonthlyContributions ? "Utveckling exkl. insättningar" : "Utveckling"}</p>
      <div class="rolling-grid">${[12,24,36].map((months) => `<div><span>${months / 12} år</span><strong>—</strong></div>`).join("")}</div>
    </article>`).join("");
}

function stateAt(portfolio, position) {
  return portfolio.states[Math.min(result.monthCount, Math.max(0, Math.floor(position)))];
}

function renderFrame(position, status) {
  const monthIndex = Math.min(result.monthCount, Math.max(0, Math.floor(position)));
  const month = monthIndex === 0 ? null : result.history[monthIndex - 1].month;
  document.querySelector("#historical-date").textContent = formatMonth(month);
  document.querySelector("#period-chip").textContent = `${monthIndex} av ${result.monthCount} månader`;
  document.querySelector("#progress-fill").style.width = `${(position / result.monthCount) * 100}%`;
  const reference = stateAt(result.portfolios[0], position);
  const startCpi = simulationCpi[0].kpi;
  const currentCpi = simulationCpi[Math.max(0, monthIndex - 1)].kpi;
  const inflationIndicator = document.querySelector("#inflation-indicator");
  inflationIndicator.classList.toggle("hidden", !settings.inflationEnabled);
  if (settings.inflationEnabled) {
    const rollingInflation = calculateRollingInflation(simulationCpi, monthIndex);
    [...inflationIndicator.querySelectorAll("strong")].forEach((node, index) => {
      node.textContent = formatPercent(rollingInflation[[12, 24, 36][index]]);
    });
  }

  result.portfolios.forEach((portfolio, index) => {
    const state = stateAt(portfolio, position);
    const card = document.querySelector(`[data-portfolio="${portfolio.definition.id}"]`);
    card.querySelector(".portfolio-value").textContent = formatCurrency(state.value);
    const inflation = card.querySelector(".inflation-value");
    inflation.classList.toggle("hidden", !settings.inflationEnabled);
    inflation.textContent = settings.inflationEnabled
      ? `Inflationsjusterat: ${formatCurrency(inflationAdjustedValue(state.value, startCpi, currentCpi))}` : "";
    const difference = state.value - reference.value;
    const differenceNode = card.querySelector(".difference");
    differenceNode.textContent = index === 0 ? "Referens" : `${formatCurrency(difference, true)} mot referens`;
    differenceNode.className = `difference ${index === 0 ? "neutral" : valueClass(difference)}`;
    [...card.querySelectorAll(".rolling-grid strong")].forEach((node, rollingIndex) => {
      const months = [12, 24, 36][rollingIndex];
      const value = state.rollingReturns[months];
      node.textContent = formatPercent(value);
      node.className = rollingReturnClass(value);
    });
  });
  graph.render(result, position, status !== "running");
}

function createPlayback() {
  playback = new PlaybackController({
    totalMonths: result.monthCount,
    durationMs: scaledPlaybackDurationMs(settings.periodYears, settings.playbackSeconds20Years),
    onFrame: renderFrame,
    onComplete: showEndActions
  });
}

function beginPlayback() {
  showScreen("presentation-screen");
  document.querySelector("#end-actions").classList.add("hidden");
  document.querySelector("#pause-button").classList.remove("hidden");
  document.querySelector("#resume-button").classList.add("hidden");
  document.querySelector("#abort-button").classList.remove("hidden");
  graph.reset();
  createPlayback();
  playback.start();
}

function showEndActions() {
  document.querySelector("#pause-button").classList.add("hidden");
  document.querySelector("#resume-button").classList.add("hidden");
  document.querySelector("#abort-button").classList.add("hidden");
  document.querySelector("#end-actions").classList.remove("hidden");
}

function returnToStart() {
  playback?.cancel();
  playback = null;
  graph.reset();
  document.querySelector("#portfolio-chart").replaceChildren();
  document.querySelector("#progress-fill").style.width = "0%";
  document.querySelector("#historical-date").textContent = "—";
  document.querySelector("#period-chip").textContent = "—";
  document.querySelector("#inflation-indicator").classList.add("hidden");
  document.querySelector("#pause-button").classList.add("hidden");
  document.querySelector("#resume-button").classList.add("hidden");
  document.querySelector("#abort-button").classList.add("hidden");
  document.querySelector("#end-actions").classList.add("hidden");
  renderStart();
  showScreen("start-screen");
}

function renderAnalysis() {
  const analysis = buildAnalysis(result);
  const finalStates = result.portfolios.map((portfolio) => portfolio.states.at(-1));
  const startCpi = simulationCpi[0].kpi;
  const finalCpi = simulationCpi.at(-1).kpi;
  document.querySelector("#analysis-period").textContent = `${result.startMonth} – ${result.endMonth}`;
  document.querySelector("#analysis-summary").innerHTML = finalStates.map((state, index) => `
    <div class="summary-card" style="--portfolio-color:${result.portfolios[index].definition.color}">
      <span>${result.portfolios[index].definition.name}</span><strong>${formatCurrency(state.value)}</strong>
      ${settings.inflationEnabled ? `<p class="summary-inflation">Inflationsjusterat: ${formatCurrency(inflationAdjustedValue(state.value, startCpi, finalCpi))}</p>` : ""}
    </div>`).join("");
  const steps = [
    { title: "Sänkt försäkringsavgift", primary: analysis.insuranceDecision.finalValueEffect, details: [] },
    { title: "Högre exponering inklusive kostnad", primary: analysis.higherExposureDecision.finalValueEffect, details: [] },
    { title: "Månadssparande", primary: analysis.savingDecision.finalValueEffect, details: [["Varav insättningar:", analysis.savingDecision.totalContributions]] }
  ];
  document.querySelector("#analysis-steps").innerHTML = `<p class="analysis-group-label">En sak i taget</p>${steps.map((step, index) => `
    <article class="analysis-step"><span class="step-number">Beslut ${index + 1}</span><h2>${step.title}</h2>
      <div class="analysis-primary ${valueClass(step.primary)}">${formatCurrency(step.primary, true)}</div>
      ${step.details.map(([label, value]) => `<div class="analysis-detail"><span>${label}</span><strong>${formatCurrency(value, label.includes("Effekt"))}</strong></div>`).join("")}
    </article>`).join("")}
    <p class="analysis-group-label">Alla tre besluten tillsammans</p>
    <article class="analysis-step combined"><span class="step-number">Kombinerat resultat</span><h2>Alla tre</h2>
      <div class="analysis-primary ${valueClass(analysis.combinedDecision.finalValueEffect)}">${formatCurrency(analysis.combinedDecision.finalValueEffect, true)}</div>
      <div class="analysis-detail"><span>Total effekt på slutkapital</span><strong>${formatCurrency(analysis.combinedDecision.finalValueEffect, true)}</strong></div>
      <p class="combined-note">När besluten kombineras förstärker de varandra över tid. Därför blir den samlade effekten större än summan av de tre isolerade effekterna.</p>
    </article>`;
  const costRows = [
    ["Fondavgifter", "cumulativeFundFees"],
    ["Försäkringsavgifter", "cumulativeInsuranceFees"],
    ["Skatt", "cumulativeTax"],
    ["Insättningar", "cumulativeContributions"]
  ];
  document.querySelector("#cost-table").innerHTML = `<thead><tr><th>Faktiskt belopp</th>${result.portfolios.map((portfolio) => `<th>${portfolio.definition.name}</th>`).join("")}</tr></thead><tbody>${costRows.map(([label, key]) => `<tr><td>${label}</td>${finalStates.map((state) => `<td>${formatCurrency(state[key])}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function fillSettingsForm(values) {
  for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = String(value);
}

function openSettings() {
  previousScreen = document.querySelector(".screen.active")?.id || "start-screen";
  playback?.pause();
  fillSettingsForm(settings);
  showScreen("settings-screen");
}

document.querySelector("#start-button").addEventListener("click", beginPlayback);
document.querySelector("#replay-button").addEventListener("click", returnToStart);
document.querySelector("#pause-button").addEventListener("click", () => {
  playback.pause();
  document.querySelector("#pause-button").classList.add("hidden");
  document.querySelector("#resume-button").classList.remove("hidden");
});
document.querySelector("#resume-button").addEventListener("click", () => {
  playback.resume();
  document.querySelector("#resume-button").classList.add("hidden");
  document.querySelector("#pause-button").classList.remove("hidden");
});
document.querySelector("#abort-button").addEventListener("click", () => {
  returnToStart();
});
document.querySelector("#analysis-button").addEventListener("click", () => showScreen("analysis-screen"));
document.querySelector("#analysis-back").addEventListener("click", () => showScreen("presentation-screen"));
document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", openSettings));
document.querySelector("#settings-cancel").addEventListener("click", () => showScreen(previousScreen));
document.querySelector("#reset-settings").addEventListener("click", () => fillSettingsForm(DEFAULT_SETTINGS));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  settings = {
    ...settings,
    ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === "inflationEnabled" ? value === "true" : Number(value)]))
  };
  rebuild();
  showScreen("start-screen");
});
window.addEventListener("resize", () => { if (result && document.querySelector("#presentation-screen").classList.contains("active")) renderFrame(playback?.position || 0, playback?.status || "idle"); });

function initializeApplication() {
  try {
    if (!Array.isArray(globalThis.SIXPRX_HISTORY)) throw new Error("Den historiska SIXPRX-datan saknas eller kunde inte läsas.");
    if (!Array.isArray(globalThis.SWEDISH_CPI_HISTORY)) throw new Error("Den historiska KPI-datan saknas eller kunde inte läsas.");
    allHistory = globalThis.SIXPRX_HISTORY.map((row) => ({ month: row.month, returnPct: row.returnPct }));
    allCpiHistory = globalThis.SWEDISH_CPI_HISTORY.map((row) => ({ month: row.month, kpi: row.kpi }));
    validateHistoricalData(allHistory);
    validateCpiData(allCpiHistory);
    rebuild();
    showScreen("start-screen");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel inträffade.";
    document.querySelector("#error-message").textContent = `Kontrollera att programmets filer är kompletta och försök igen. ${message}`;
    showScreen("error-screen");
  }
}

initializeApplication();

})();
