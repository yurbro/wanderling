import type { EndingSeason } from './types';

/**
 * The end of the long main line, by the time of year (decisions.md section
 * 9, ruling 24): the northern lights from September to early April, the
 * midnight sun from late May to late July, and between them the bright
 * night, when the sky at midnight is still blue.
 */

/** Day of the year, 1 to 366, by the local calendar. */
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1).getTime();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((today - start) / 86_400_000) + 1;
}

const md = (month: number, day: number, year: number): number => dayOfYear(new Date(year, month - 1, day));

export function endingSeason(at: Date | number): EndingSeason {
  const d = new Date(at);
  const y = d.getFullYear();
  const n = dayOfYear(d);
  if (n >= md(9, 1, y) || n <= md(4, 10, y)) return 'aurora';
  if (n >= md(5, 20, y) && n <= md(7, 22, y)) return 'midnightSun';
  return 'brightNight';
}
