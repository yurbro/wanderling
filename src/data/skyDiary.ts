import type { WeatherCondition } from '../core/types';

/**
 * The person's weather, one sample a day (early afternoon), kept whenever
 * the app is open and the forecast covers that hour. The week of sky is
 * painted from it; days it missed are asked of the weather history once,
 * and anything still unknown is simply a clear sky.
 */

const KEY = 'wanderling.skyDiary';
const KEEP = 40;

export interface DiaryEntry {
  condition: WeatherCondition;
  code: number;
  temperature: number;
}

export type SkyDiary = Record<string, DiaryEntry>;

export function loadDiary(): SkyDiary {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const out: SkyDiary = {};
    for (const [day, v] of Object.entries(p)) {
      const e = v as Record<string, unknown> | null;
      if (e && typeof e.condition === 'string' && typeof e.code === 'number' && typeof e.temperature === 'number') {
        out[day] = { condition: e.condition as WeatherCondition, code: e.code, temperature: e.temperature };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDiary(d: SkyDiary): void {
  try {
    const days = Object.keys(d).sort();
    const kept = Object.fromEntries(days.slice(Math.max(0, days.length - KEEP)).map((k) => [k, d[k]]));
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Fine.
  }
}
