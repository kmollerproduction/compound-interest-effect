export function getVisibleMonthDomain(position, totalMonths) {
  return { start: 0, end: Math.min(totalMonths, Math.max(12, position)) };
}

export function getVisibleSeries(portfolio, position) {
  const completed = Math.max(0, Math.min(portfolio.states.length - 1, Math.floor(position)));
  return portfolio.states.slice(0, completed + 1);
}

export function getVisibleYDomain(portfolios, position, paddingRatio = 0.1) {
  const values = portfolios.flatMap((portfolio) => getVisibleSeries(portfolio, position).map((state) => state.value));
  return getYDomainForValues(values, paddingRatio);
}

export function getYDomainForValues(values, paddingRatio = 0.1) {
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
