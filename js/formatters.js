const currencyFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" });

export function formatCurrency(value, signed = false) {
  const rounded = Math.round(value);
  const sign = signed && rounded > 0 ? "+" : signed && rounded < 0 ? "−" : "";
  return `${sign}${currencyFormatter.format(Math.abs(rounded))} kr`;
}

export function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  const percentage = value * 100;
  const sign = percentage > 0 ? "+" : percentage < 0 ? "−" : "";
  return `${sign}${percentFormatter.format(Math.abs(percentage))} %`;
}

export function formatMonth(month) {
  if (!month) return "Start";
  const [year, monthNumber] = month.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(year, monthNumber - 1, 1))).toLocaleUpperCase("sv-SE");
}

export function valueClass(value) {
  return value > 0.5 ? "positive" : value < -0.5 ? "negative" : "neutral";
}
