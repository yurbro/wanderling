import { clamp01 } from './color';
import type { WeatherCondition, WeatherState } from './types';

/**
 * Weather, the pure part: folding WMO weather codes into the few looks the
 * scene can draw, turning a forecast response into a compact snapshot, and
 * picking the right sample out of that snapshot for any moment (so an old
 * fetch still gives a sensible sky when the network is gone).
 *
 * No fetch, no storage here; that lives in src/data/weather.ts.
 */

interface CodeInfo {
  condition: WeatherCondition;
  /** English label for the HUD. */
  label: string;
  /** 0..1 intensities the code implies on its own. */
  rain: number;
  snow: number;
  /** The least cloud this weather can reasonably come with. */
  minCloud: number;
}

const info = (
  condition: WeatherCondition,
  label: string,
  rain = 0,
  snow = 0,
  minCloud = 0,
): CodeInfo => ({ condition, label, rain, snow, minCloud });

/** WMO 4677 weather interpretation codes as used by Open-Meteo. */
const CODES: Record<number, CodeInfo> = {
  0: info('clear', 'Clear'),
  1: info('clear', 'Mostly clear'),
  2: info('partly-cloudy', 'Partly cloudy', 0, 0, 0.35),
  3: info('overcast', 'Overcast', 0, 0, 0.85),
  45: info('fog', 'Fog', 0, 0, 0.5),
  48: info('fog', 'Freezing fog', 0, 0, 0.5),
  51: info('drizzle', 'Light drizzle', 0.2, 0, 0.7),
  53: info('drizzle', 'Drizzle', 0.3, 0, 0.75),
  55: info('drizzle', 'Dense drizzle', 0.4, 0, 0.8),
  56: info('drizzle', 'Freezing drizzle', 0.3, 0, 0.75),
  57: info('drizzle', 'Freezing drizzle', 0.4, 0, 0.8),
  61: info('rain', 'Light rain', 0.45, 0, 0.8),
  63: info('rain', 'Rain', 0.65, 0, 0.85),
  65: info('heavy-rain', 'Heavy rain', 1, 0, 0.95),
  66: info('rain', 'Freezing rain', 0.5, 0, 0.85),
  67: info('heavy-rain', 'Heavy freezing rain', 0.9, 0, 0.95),
  71: info('snow', 'Light snow', 0, 0.4, 0.8),
  73: info('snow', 'Snow', 0, 0.65, 0.85),
  75: info('heavy-snow', 'Heavy snow', 0, 1, 0.95),
  77: info('snow', 'Snow grains', 0, 0.35, 0.8),
  80: info('rain', 'Showers', 0.5, 0, 0.6),
  81: info('rain', 'Showers', 0.7, 0, 0.7),
  82: info('heavy-rain', 'Violent showers', 1, 0, 0.85),
  85: info('snow', 'Snow showers', 0, 0.5, 0.7),
  86: info('heavy-snow', 'Heavy snow showers', 0, 0.9, 0.85),
  95: info('thunderstorm', 'Thunderstorm', 0.75, 0, 0.9),
  96: info('thunderstorm', 'Thunderstorm with hail', 0.85, 0, 0.9),
  99: info('thunderstorm', 'Thunderstorm with hail', 0.95, 0, 0.95),
};

/** Fallback for unknown codes: let the cloud cover decide. */
function fromCloudCover(cloudCover: number): CodeInfo {
  if (cloudCover < 0.25) return CODES[0];
  if (cloudCover < 0.75) return CODES[2];
  return CODES[3];
}

export function codeInfo(code: number, cloudCover = 0): CodeInfo {
  return CODES[code] ?? fromCloudCover(cloudCover);
}

export function conditionFromCode(code: number, cloudCover = 0): WeatherCondition {
  return codeInfo(code, cloudCover).condition;
}

/** Short English label for the HUD, e.g. "Light rain". */
export function describeWeather(ws: WeatherState): string {
  return codeInfo(ws.code, ws.cloudCover).label;
}

export function formatTemperature(celsius: number, unit: 'C' | 'F'): string {
  const v = unit === 'F' ? celsius * 1.8 + 32 : celsius;
  return `${Math.round(v)}°`;
}

/** A representative code for each condition, used by the demo controls. */
export const CONDITION_CODES: Record<WeatherCondition, number> = {
  clear: 0,
  'partly-cloudy': 2,
  overcast: 3,
  fog: 45,
  drizzle: 53,
  rain: 63,
  'heavy-rain': 65,
  thunderstorm: 95,
  snow: 73,
  'heavy-snow': 75,
};

export const CONDITIONS = Object.keys(CONDITION_CODES) as WeatherCondition[];

/** Typical cloud cover per condition for demos; real data overrides it. */
const DEMO_CLOUD: Record<WeatherCondition, number> = {
  clear: 0.05,
  'partly-cloudy': 0.5,
  overcast: 1,
  fog: 0.7,
  drizzle: 0.9,
  rain: 1,
  'heavy-rain': 1,
  thunderstorm: 1,
  snow: 0.95,
  'heavy-snow': 1,
};

/** Build a plausible WeatherState for a condition, for demos and screenshots. */
export function demoWeather(
  condition: WeatherCondition,
  now: Date,
  overrides: Partial<WeatherState> = {},
): WeatherState {
  const cold = condition === 'snow' || condition === 'heavy-snow';
  return {
    condition,
    code: CONDITION_CODES[condition],
    cloudCover: DEMO_CLOUD[condition],
    temperature: cold ? -2 : 14,
    windSpeed: condition === 'thunderstorm' ? 35 : 12,
    windDirection: 250,
    precipitation: 0,
    time: now,
    source: 'demo',
    ...overrides,
  };
}

/* ------------------------------------------------------------------------ */
/* Intensities for the scene                                                 */
/* ------------------------------------------------------------------------ */

export interface WeatherIntensities {
  cloud: number;
  fog: number;
  rain: number;
  snow: number;
  /** Screen drift -1..1. */
  wind: number;
  lightning: number;
}

export const NO_WEATHER: WeatherIntensities = {
  cloud: 0,
  fog: 0,
  rain: 0,
  snow: 0,
  wind: 0,
  lightning: 0,
};

/**
 * Turn a WeatherState into 0..1 knobs for the director. The weather code sets
 * the character, the measured cloud cover and precipitation nudge it.
 */
export function weatherIntensities(ws: WeatherState | null): WeatherIntensities {
  if (!ws) return NO_WEATHER;
  const ci = codeInfo(ws.code, ws.cloudCover);
  const measured = clamp01(ws.cloudCover);
  let cloud = Math.max(measured, ci.minCloud);
  if (ci.condition === 'clear') cloud = Math.min(measured, 0.3);

  const mm = Math.max(0, ws.precipitation);
  // A millimetre an hour is a steady rain; eight is a downpour.
  const fromMm = clamp01(mm / 8);
  const rain = ci.rain > 0 ? clamp01(ci.rain * 0.75 + fromMm * 0.35) : 0;
  const snow = ci.snow > 0 ? clamp01(ci.snow * 0.75 + fromMm * 0.35) : 0;

  let fog = 0;
  if (ci.condition === 'fog') fog = 0.85;
  else if (ci.condition === 'drizzle') fog = 0.25;
  else if (snow > 0) fog = 0.2 * snow;

  return {
    cloud,
    fog,
    rain,
    snow,
    wind: windDrift(ws.windSpeed, ws.windDirection),
    lightning: ci.condition === 'thunderstorm' ? 1 : 0,
  };
}

/**
 * Convert wind into a screen drift. The scene faces south, so east is on the
 * left: a west wind (blowing from 270 degrees) pushes clouds towards the left.
 */
export function windDrift(speedKmh: number, fromDegrees: number): number {
  const strength = clamp01(speedKmh / 40);
  const dir = (fromDegrees * Math.PI) / 180;
  // The + 0 turns a negative zero into a plain zero.
  return Math.max(-1, Math.min(1, Math.sin(dir) * strength)) + 0;
}

/* ------------------------------------------------------------------------ */
/* Forecast snapshots                                                        */
/* ------------------------------------------------------------------------ */

export interface HourSample {
  /** Milliseconds since the epoch. */
  time: number;
  code: number;
  /** 0..1 */
  cloudCover: number;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
}

/** A whole forecast response boiled down to what the scene needs. */
export interface WeatherSnapshot {
  /** When the fetch happened, milliseconds since the epoch. */
  fetchedAt: number;
  lat: number;
  lon: number;
  current: HourSample;
  hourly: HourSample[];
}

/** Cache is considered fresh for this long. */
export const FRESH_MS = 45 * 60_000;
/** A current observation is used instead of the hourly forecast for this long. */
export const CURRENT_WINDOW_MS = 50 * 60_000;
/** How far from a forecast hour we still accept it. */
export const HOUR_TOLERANCE_MS = 61 * 60_000;

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Parse an Open-Meteo forecast response requested with timeformat=unixtime.
 * Returns null when the shape is not what we expect, never throws.
 */
export function parseForecast(
  json: unknown,
  fetchedAt: number,
  lat: number,
  lon: number,
): WeatherSnapshot | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const cur = j.current as Record<string, unknown> | undefined;
  const hourly = j.hourly as Record<string, unknown[]> | undefined;
  if (!cur || typeof cur.time !== 'number' || typeof cur.weather_code !== 'number') return null;

  const current: HourSample = {
    time: cur.time * 1000,
    code: num(cur.weather_code),
    cloudCover: clamp01(num(cur.cloud_cover) / 100),
    temperature: num(cur.temperature_2m),
    windSpeed: num(cur.wind_speed_10m),
    windDirection: num(cur.wind_direction_10m),
    precipitation: num(cur.precipitation),
  };

  const samples: HourSample[] = [];
  const times = Array.isArray(hourly?.time) ? hourly!.time : [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== 'number') continue;
    samples.push({
      time: t * 1000,
      code: num(hourly!.weather_code?.[i], current.code),
      cloudCover: clamp01(num(hourly!.cloud_cover?.[i], current.cloudCover * 100) / 100),
      temperature: num(hourly!.temperature_2m?.[i], current.temperature),
      windSpeed: num(hourly!.wind_speed_10m?.[i], current.windSpeed),
      windDirection: num(hourly!.wind_direction_10m?.[i], current.windDirection),
      precipitation: num(hourly!.precipitation?.[i]),
    });
  }

  return { fetchedAt, lat, lon, current, hourly: samples };
}

function toState(s: HourSample, source: WeatherState['source']): WeatherState {
  return {
    condition: conditionFromCode(s.code, s.cloudCover),
    code: s.code,
    cloudCover: s.cloudCover,
    temperature: s.temperature,
    windSpeed: s.windSpeed,
    windDirection: s.windDirection,
    precipitation: s.precipitation,
    time: new Date(s.time),
    source,
  };
}

/**
 * The best WeatherState a snapshot can offer for a moment: the current
 * observation while it is recent, otherwise the nearest hourly forecast slot,
 * otherwise null (the forecast has run out, draw a clear sky).
 */
export function weatherAt(snap: WeatherSnapshot, now: Date): WeatherState | null {
  const t = now.getTime();
  if (Math.abs(t - snap.current.time) <= CURRENT_WINDOW_MS) {
    return toState(snap.current, 'current');
  }
  let best: HourSample | null = null;
  let bestDist = Infinity;
  for (const s of snap.hourly) {
    const d = Math.abs(s.time - t);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  if (best && bestDist <= HOUR_TOLERANCE_MS) return toState(best, 'forecast');
  return null;
}

/** Fresh enough to skip a fetch: young, and for (roughly) the same place. */
export function isFresh(snap: WeatherSnapshot, now: Date, lat: number, lon: number): boolean {
  const age = now.getTime() - snap.fetchedAt;
  if (age < 0 || age > FRESH_MS) return false;
  return Math.abs(snap.lat - lat) < 0.051 && Math.abs(snap.lon - lon) < 0.051;
}
