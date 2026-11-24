import { Outing } from '../db/model';

function top(values: string[]) {
  const count = new Map<string, number>();
  for (const value of values) {
    if (value) count.set(value, (count.get(value) ?? 0) + 1);
  }
  return Array.from(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export function annualStats(outings: Outing[], year: number) {
  const entries = outings.filter((item) => Number(item.date.slice(0, 4)) === year);
  const catches = entries.flatMap((item) => item.catches);
  const months = Array.from({ length: 12 }, () => 0);
  for (const item of entries) months[Number(item.date.slice(5, 7)) - 1]++;
  const maximum = Math.max(...months);
  const bestMonth = maximum ? months.indexOf(maximum) : undefined;
  return {
    months, bestMonth, total: entries.length, catches: catches.length,
    distance: entries.reduce((total, item) => total + (item.route?.distance ?? 0), 0),
    bestBait: top(catches.map(({ bait }) => bait.trim().toLowerCase())),
    bestTime: top(catches.map(({ time }) => time.slice(0, 2))),
  };
}
