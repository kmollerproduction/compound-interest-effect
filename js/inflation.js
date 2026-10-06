const CPI_FIRST_MONTH = "2006-10";
const CPI_LAST_MONTH = "2026-08";
const CPI_OBSERVATION_COUNT = 239;

export function parseCpiCsv(text) {
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

export function validateCpiData(rows) {
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

export function cpiForMonth(rows, month) {
  return cpiObservationForMonth(rows, month).kpi;
}

export function buildSimulationCpiSeries(rows, marketHistory) {
  validateCpiData(rows);
  return marketHistory.map(({ month }) => {
    const observation = cpiObservationForMonth(rows, month);
    return { month, cpiMonth: observation.month, kpi: observation.kpi };
  });
}

export function inflationAdjustedValue(nominalValue, startCpi, currentCpi) {
  if (![nominalValue, startCpi, currentCpi].every(Number.isFinite) || startCpi <= 0 || currentCpi <= 0) {
    throw new Error("Invalid value for CPI adjustment");
  }
  return nominalValue * startCpi / currentCpi;
}

export function calculateRollingInflation(cpiSeries, completedMonths) {
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
