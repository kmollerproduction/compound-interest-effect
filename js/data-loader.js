export function parseHistoricalCsv(text) {
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

export function validateHistoricalData(rows) {
  if (rows.length !== 240) throw new Error(`Expected 240 historical rows, received ${rows.length}`);
  if (rows[0].month !== "2006-10" || rows.at(-1).month !== "2026-09") throw new Error("Unexpected historical range");
  for (let i = 1; i < rows.length; i += 1) {
    const [year, month] = rows[i - 1].month.split("-").map(Number);
    const expected = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    if (rows[i].month !== expected) throw new Error(`Missing or out-of-order month before ${rows[i].month}`);
  }
  return rows;
}

export function selectHistoricalPeriod(rows, years) {
  if (![5, 10, 15, 20].includes(years)) throw new Error("Unsupported period");
  const selected = rows.slice(-(years * 12));
  if (selected.length !== years * 12 || selected.at(-1)?.month !== "2026-09") throw new Error("Historical period unavailable");
  return selected;
}
