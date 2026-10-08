import SunCalc from 'suncalc';
import { dayKey, type Candidate } from './letters';
import type { SurpriseLog } from './surprises';

/**
 * The astronomical calendar: full moons, the meteor showers, the longest and
 * shortest days and the equinoxes, worked out on the device. It is the one
 * source for sky letters (review 3, ruling 8): the full-moon surprise in the
 * scene asks it whether tonight is the night, and each event becomes at most
 * one letter. A full moon he watched with the person open is a sky letter
 * the next morning ("I think you saw it too"); one that went unseen is the
 * surprise engine's missed letter instead; the two share the letter engine's
 * one-a-day group, so the person gets one or the other, never both.
 */

const H = 3_600_000;
const DAY = 24 * H;

/** The full moons between two moments, as instants (to the minute). */
export function fullMoons(from: number, to: number): number[] {
  const out: number[] = [];
  const phase = (t: number): number => SunCalc.getMoonIllumination(new Date(t)).phase;
  const step = 6 * H;
  let prev = phase(from);
  for (let t = from + step; t <= to + step; t += step) {
    const cur = phase(t);
    if (prev < 0.5 && cur >= 0.5) {
      let lo = t - step;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        if (phase(mid) < 0.5) lo = mid;
        else hi = mid;
      }
      if (hi >= from && hi <= to) out.push(Math.round(hi));
    }
    prev = cur;
  }
  return out;
}

/**
 * The evening a full moon belongs to, as a local day key: the one whose
 * late evening (about 22:30) lies nearest the full moon itself.
 */
export function fullMoonEvening(instant: number): string {
  return dayKey(instant - 10.5 * H);
}

/** Which evening a moment belongs to: the hours after midnight still count as the night before. */
export function eveningOf(at: number): string {
  return dayKey(at - 12 * H);
}

/** The full-moon evenings around a moment, for the surprise engine's facts. */
export function fullMoonEvenings(around: number, daysBack = 5, daysAhead = 3): Set<string> {
  return new Set(fullMoons(around - daysBack * DAY, around + daysAhead * DAY).map(fullMoonEvening));
}

export type SkyKind = 'fullMoon' | 'meteors' | 'longest' | 'shortest' | 'equinox';

export interface SkyEvent {
  id: string;
  kind: SkyKind;
  /** The evening (full moon, falling stars) or the day (solstice, equinox) it belongs to. */
  day: string;
  /** When its letter is due: the next morning for a night, nine o'clock on the day for a day. */
  letterAt: number;
  /** For a night: once this has passed, the night is over and its letter can be decided. */
  settledAt: number;
}

/** The meteor showers' best nights (month 1-12, day), and which hemisphere sees them well. */
const SHOWERS: { name: string; month: number; day: number; north: boolean; south: boolean }[] = [
  { name: 'quadrantids', month: 1, day: 3, north: true, south: false },
  { name: 'lyrids', month: 4, day: 22, north: true, south: true },
  { name: 'eta-aquariids', month: 5, day: 5, north: false, south: true },
  { name: 'perseids', month: 8, day: 12, north: true, south: false },
  { name: 'orionids', month: 10, day: 21, north: true, south: true },
  { name: 'geminids', month: 12, day: 13, north: true, south: true },
];

const at = (y: number, m: number, d: number, hour: number): number => new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
const keyOf = (y: number, m: number, d: number): string => dayKey(at(y, m, d, 12));

/** Every sky event between two moments, for the person's latitude. */
export function skyEvents(from: number, to: number, lat: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  const north = lat >= 0;
  for (const f of fullMoons(from - 2 * DAY, to)) {
    const day = fullMoonEvening(f);
    const [y, m, d] = day.split('-').map(Number);
    out.push({ id: `sky:fullMoon:${day}`, kind: 'fullMoon', day, letterAt: at(y, m, d + 1, 9), settledAt: at(y, m, d + 1, 6) });
  }
  const y0 = new Date(from).getFullYear();
  const y1 = new Date(to).getFullYear();
  for (let y = y0; y <= y1; y++) {
    for (const s of SHOWERS) {
      if (north ? !s.north : !s.south) continue;
      out.push({ id: `sky:meteors:${s.name}:${y}`, kind: 'meteors', day: keyOf(y, s.month, s.day), letterAt: at(y, s.month, s.day + 1, 9), settledAt: at(y, s.month, s.day + 1, 6) });
    }
    // The turning days, near enough: the date moves by a day at most.
    const june = at(y, 6, 21, 9);
    const dec = at(y, 12, 21, 9);
    out.push({ id: `sky:solstice:${y}-06`, kind: north ? 'longest' : 'shortest', day: keyOf(y, 6, 21), letterAt: june, settledAt: june });
    out.push({ id: `sky:solstice:${y}-12`, kind: north ? 'shortest' : 'longest', day: keyOf(y, 12, 21), letterAt: dec, settledAt: dec });
    out.push({ id: `sky:equinox:${y}-03`, kind: 'equinox', day: keyOf(y, 3, 20), letterAt: at(y, 3, 20, 9), settledAt: at(y, 3, 20, 9) });
    out.push({ id: `sky:equinox:${y}-09`, kind: 'equinox', day: keyOf(y, 9, 22), letterAt: at(y, 9, 22, 9), settledAt: at(y, 9, 22, 9) });
  }
  return out.filter((e) => e.letterAt >= from - 2 * DAY && e.settledAt <= to + 2 * DAY).sort((a, b) => a.letterAt - b.letterAt);
}

/** How long after an event its letter may still be written: no letters about long-ago skies. */
export const SKY_LETTER_WINDOW_MS = 3 * DAY;

/**
 * Sky letters due by `now`, for events after `since` (when the person began)
 * and no older than a few days. `pools` maps each kind of letter to its
 * skeletons. A full moon looks at the surprise log: watched, a "you saw it
 * too"; missed, nothing here (the missed letter covers it); never up, the
 * quiet "it was there all the same".
 */
export function skyLetters(
  log: SurpriseLog,
  now: number,
  since: number,
  lat: number,
  pools: Record<'moonSeen' | 'moonHidden' | 'meteors' | 'longest' | 'shortest' | 'equinox', string[]>,
): Candidate[] {
  const out: Candidate[] = [];
  for (const e of skyEvents(now - SKY_LETTER_WINDOW_MS - 2 * DAY, now, lat)) {
    if (now < e.settledAt || e.letterAt < now - SKY_LETTER_WINDOW_MS) continue;
    // Only skies after the journey began: a full moon the night before installing is nobody's.
    if (e.settledAt - 12 * H < since) continue;
    let pool: string[];
    if (e.kind === 'fullMoon') {
      const nights = log.events.filter((x) => x.id === 'fullMoon' && eveningOf(x.at) === e.day);
      if (nights.some((x) => x.witnessed)) pool = pools.moonSeen;
      else if (nights.length > 0) continue;
      else pool = pools.moonHidden;
    } else {
      pool = pools[e.kind];
    }
    out.push({ id: e.id, kind: 'sky', wantAt: e.letterAt, pool });
  }
  return out;
}
