import { DEFAULT_SETTINGS } from "./config.js";
import { selectHistoricalPeriod, validateHistoricalData } from "./data-loader.js";
import { runSimulation } from "./simulation-engine.js";
import { buildAnalysis } from "./analysis.js";
import { PlaybackController, scaledPlaybackDurationMs } from "./playback-controller.js";
import { GraphRenderer } from "./graph-renderer.js";
import { formatCurrency, formatMonth, formatPercent, valueClass } from "./formatters.js";

const screens = [...document.querySelectorAll(".screen")];
const form = document.querySelector("#settings-form");
const graph = new GraphRenderer(document.querySelector("#portfolio-chart"));
let allHistory;
let settings = { ...DEFAULT_SETTINGS };
let result;
let playback;
let previousScreen = "start-screen";

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
}

function rebuild() {
  const selected = selectHistoricalPeriod(allHistory, settings.periodYears);
  result = runSimulation(selected, settings);
  renderStart();
  renderCards();
  renderAnalysis();
  graph.reset();
}

function renderStart() {
  document.querySelector("#start-period").textContent = `${result.startMonth} – ${result.endMonth} · ${settings.periodYears} år`;
  document.querySelector("#start-capital").textContent = formatCurrency(settings.startingCapital);
}

function renderCards() {
  document.querySelector("#portfolio-grid").innerHTML = result.portfolios.map((portfolio, index) => `
    <article class="portfolio-card" style="--portfolio-color:${portfolio.definition.color}" data-portfolio="${portfolio.definition.id}">
      <h3>${portfolio.definition.name}</h3>
      <div class="portfolio-value">${formatCurrency(settings.startingCapital)}</div>
      <div class="inflation-value"></div>
      <div class="difference neutral">${index === 0 ? "Referens" : "0 kr mot referens"}</div>
      <p class="rolling-title">Utveckling exkl. insättningar</p>
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

  result.portfolios.forEach((portfolio, index) => {
    const state = stateAt(portfolio, position);
    const card = document.querySelector(`[data-portfolio="${portfolio.definition.id}"]`);
    card.querySelector(".portfolio-value").textContent = formatCurrency(state.value);
    const inflation = card.querySelector(".inflation-value");
    inflation.textContent = settings.inflationEnabled
      ? `Inflationsjusterat: ${formatCurrency(state.value / ((1 + settings.annualInflationPct / 100) ** (monthIndex / 12)))}` : "";
    const difference = state.value - reference.value;
    const differenceNode = card.querySelector(".difference");
    differenceNode.textContent = index === 0 ? "Referens" : `${formatCurrency(difference, true)} mot referens`;
    differenceNode.className = `difference ${index === 0 ? "neutral" : valueClass(difference)}`;
    [...card.querySelectorAll(".rolling-grid strong")].forEach((node, rollingIndex) => {
      const months = [12, 24, 36][rollingIndex];
      const value = state.rollingReturns[months];
      node.textContent = formatPercent(value);
      node.className = value === null ? "neutral" : valueClass(value);
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
  graph.reset();
  createPlayback();
  playback.start();
}

function showEndActions() {
  document.querySelector("#pause-button").classList.add("hidden");
  document.querySelector("#resume-button").classList.add("hidden");
  document.querySelector("#end-actions").classList.remove("hidden");
}

function renderAnalysis() {
  const analysis = buildAnalysis(result);
  const finalStates = result.portfolios.map((portfolio) => portfolio.states.at(-1));
  document.querySelector("#analysis-period").textContent = `${result.startMonth} – ${result.endMonth}`;
  document.querySelector("#analysis-summary").innerHTML = finalStates.map((state, index) => `
    <div class="summary-card" style="--portfolio-color:${result.portfolios[index].definition.color}">
      <span>${result.portfolios[index].definition.name}</span><strong>${formatCurrency(state.value)}</strong>
    </div>`).join("");
  const steps = [
    { title: "Sänkt försäkringsavgift", primary: analysis.insuranceDecision.finalValueEffect, details: [["Undvikna försäkringsavgifter", analysis.insuranceDecision.insuranceFeesAvoided], ["Effekt på slutkapital", analysis.insuranceDecision.finalValueEffect]] },
    { title: "Högre exponering inklusive kostnad", primary: analysis.higherExposureDecision.finalValueEffect, details: [["Fondavgifter · Portfölj 2", analysis.higherExposureDecision.portfolio2FundFees], ["Fondavgifter · Portfölj 3", analysis.higherExposureDecision.portfolio3FundFees]] },
    { title: "Månadssparande", primary: analysis.savingDecision.finalValueEffect, details: [["Totala insättningar", analysis.savingDecision.totalContributions], ["Avkastning från insättningarna", analysis.savingDecision.returnGenerated]] }
  ];
  document.querySelector("#analysis-steps").innerHTML = steps.map((step, index) => `
    <article class="analysis-step"><span class="step-number">Beslut ${index + 1}</span><h2>${step.title}</h2>
      <div class="analysis-primary ${valueClass(step.primary)}">${formatCurrency(step.primary, true)}</div>
      ${step.details.map(([label, value]) => `<div class="analysis-detail"><span>${label}</span><strong>${formatCurrency(value, label.includes("Effekt"))}</strong></div>`).join("")}
    </article>`).join("");
  document.querySelector("#cost-table").innerHTML = `<thead><tr><th>Portfölj</th><th>Fondavgifter</th><th>Försäkringsavgifter</th><th>Skatt</th><th>Insättningar</th></tr></thead><tbody>${finalStates.map((state, index) => `<tr><td>${result.portfolios[index].definition.name}</td><td>${formatCurrency(state.cumulativeFundFees)}</td><td>${formatCurrency(state.cumulativeInsuranceFees)}</td><td>${formatCurrency(state.cumulativeTax)}</td><td>${formatCurrency(state.cumulativeContributions)}</td></tr>`).join("")}</tbody>`;
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
document.querySelector("#replay-button").addEventListener("click", beginPlayback);
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
    allHistory = globalThis.SIXPRX_HISTORY.map((row) => ({ month: row.month, returnPct: row.returnPct }));
    validateHistoricalData(allHistory);
    rebuild();
    showScreen("start-screen");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel inträffade.";
    document.querySelector("#error-message").textContent = `Kontrollera att programmets filer är kompletta och försök igen. ${message}`;
    showScreen("error-screen");
  }
}

initializeApplication();
