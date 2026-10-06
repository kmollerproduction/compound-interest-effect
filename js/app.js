import { DEFAULT_SETTINGS } from "./config.js";
import { selectHistoricalPeriod, validateHistoricalData } from "./data-loader.js";
import { runSimulation } from "./simulation-engine.js";
import { buildAnalysis } from "./analysis.js";
import { PlaybackController, scaledPlaybackDurationMs } from "./playback-controller.js";
import { GraphRenderer } from "./graph-renderer.js";
import { buildSimulationCpiSeries, calculateRollingInflation, inflationAdjustedValue, validateCpiData } from "./inflation.js";
import { formatCurrency, formatMonth, formatPercent, rollingReturnClass, valueClass } from "./formatters.js";

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
