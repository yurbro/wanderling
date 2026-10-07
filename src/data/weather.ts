import type { GeoPoint, WeatherState } from '../core/types';
import { isFresh, parseForecast, weatherAt, type WeatherSnapshot, tomorrowOutlook,
  rainHours, type Outlook } from '../core/weather';

/**
 * Open-Meteo weather with a small cache and a quiet failure mode.
 *
 * - Requests use the coarse (two decimal) coordinates we already store.
 * - The last response is kept in localStorage; it is reused for 45 minutes,
 *   and when the network is gone its hourly forecast keeps feeding the scene
 *   for up to two days before we fall back to a clear sky.
 * - Nothing here throws into the UI: a failed fetch just means "no change".
 */

const KEY = 'wanderling.weather';
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 10_000;

export function forecastUrl(p: GeoPoint): string {
  const q = new URLSearchParams({
    latitude: p.lat.toFixed(2),
    longitude: p.lon.toFixed(2),
    current: [
      'temperature_2m',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'cloud_cover',
      'precipitation',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    forecast_days: '2',
    // Yesterday too, so a rainbow after this morning's rain can be told on opening.
    past_days: '1',
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  return `${ENDPOINT}?${q.toString()}`;
}

export function loadSnapshot(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as WeatherSnapshot;
    if (typeof s.fetchedAt !== 'number' || !s.current || !Array.isArray(s.hourly)) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSnapshot(s: WeatherSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: the in-memory copy still works for this visit.
  }
}

/** Fetch and parse a forecast. Throws on network or shape problems. */
export async function fetchSnapshot(
  p: GeoPoint,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<WeatherSnapshot> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(forecastUrl(p), { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`weather http ${res.status}`);
    const json: unknown = await res.json();
    const snap = parseForecast(json, now, p.lat, p.lon);
    if (!snap) throw new Error('weather response not understood');
    return snap;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type WeatherStatus = 'idle' | 'loading' | 'ok' | 'offline';

/**
 * Keeps the best weather we have and refreshes it when it goes stale.
 * `onChange` fires after every successful refresh so the scene can redraw.
 */
export class WeatherService {
  private snapshot: WeatherSnapshot | null;
  private inflight: Promise<void> | null = null;
  status: WeatherStatus = 'idle';

  constructor(
    private readonly onChange: () => void,
    initial: WeatherSnapshot | null = loadSnapshot(),
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    this.snapshot = initial;
  }

  /** Weather for a moment from whatever we have, or null. Never fetches. */
  current(now: Date): WeatherState | null {
    return this.snapshot ? weatherAt(this.snapshot, now) : null;
  }

  /** Tomorrow's rain, snow and wind where the person is, from the cached forecast; null when unknown. */
  outlook(now: Date): Outlook | null {
    return tomorrowOutlook(this.snapshot, now);
  }

  /** The hours we know and how hard it rained in each. */
  rain(): { time: number; rain: number }[] {
    return rainHours(this.snapshot);
  }

  /** True when the cached snapshot is young and for this place. */
  isFresh(p: GeoPoint, now: Date = new Date()): boolean {
    return !!this.snapshot && isFresh(this.snapshot, now, p.lat, p.lon);
  }

  /** Fetch if stale. Resolves when done; never rejects. */
  async refresh(p: GeoPoint, now: Date = new Date()): Promise<void> {
    if (this.isFresh(p, now)) return;
    if (this.inflight) return this.inflight;
    this.status = 'loading';
    this.inflight = (async () => {
      try {
        const snap = await fetchSnapshot(p, this.fetchImpl, now.getTime());
        this.snapshot = snap;
        saveSnapshot(snap);
        this.status = 'ok';
        this.onChange();
      } catch (err) {
        this.status = 'offline';
        console.warn('[wanderling] weather unavailable, keeping what we have', err);
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
}
