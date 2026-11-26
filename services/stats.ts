import type { Catch, Outing } from '../db/model';

export function diaryStats(outings: Outing[]) {
  let catches = 0;
  let distance = 0;
  let biggestCatch: { capture: Catch; size: number; outing: Outing } | undefined;
  let longestOuting: { outing: Outing; distance: number } | undefined;
  let mostActiveMonth: { key: string; count: number } | undefined;
  const months = new Map<string, number>();
  for (const outing of outings) {
    catches += outing.catches.length;
    const km = outing.route?.distance;
    if (typeof km === 'number' && Number.isFinite(km) && km >= 0) {
      distance += km;
      if (!longestOuting || km > longestOuting.distance) longestOuting = { outing, distance: km };
    }
    for (const capture of outing.catches) {
      const size = capture.size;
      if (typeof size === 'number' && Number.isFinite(size) && size >= 0 && (!biggestCatch || size > biggestCatch.size)) {
        biggestCatch = { capture, size, outing };
      }
    }
    const key = outing.date.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) continue;
    const count = (months.get(key) ?? 0) + 1;
    months.set(key, count);
    if (!mostActiveMonth || count > mostActiveMonth.count || (count === mostActiveMonth.count && key > mostActiveMonth.key)) {
      mostActiveMonth = { key, count };
    }
  }
  return { catches, distance, biggestCatch, longestOuting, mostActiveMonth };
}

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
  for (const item of entries) {
    const month = Number(item.date.slice(5, 7)) - 1;
    if (month >= 0 && month < months.length) months[month]++;
  }
  const maximum = Math.max(...months);
  const bestMonth = maximum ? months.indexOf(maximum) : undefined;
  return {
    months, bestMonth, total: entries.length, catches: catches.length,
    distance: entries.reduce((total, item) => total + (item.route?.distance ?? 0), 0),
    bestBait: top(catches.map(({ bait }) => (bait ?? '').trim().toLowerCase())),
    bestTime: top(catches.map(({ time }) => (time ?? '').slice(0, 2))),
  };
}
