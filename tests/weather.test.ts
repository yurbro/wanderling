import { describe, expect, it } from 'vitest';
import {
  CURRENT_WINDOW_MS,
  FRESH_MS,
  conditionFromCode,
  demoWeather,
  describeWeather,
  formatTemperature,
  isFresh,
  parseForecast,
  weatherAt,
  weatherIntensities,
  windDrift,
} from '../src/core/weather';

/** A trimmed Open-Meteo response, requested with timeformat=unixtime. */
const T0 = Date.UTC(2026, 9, 4, 15, 0, 0); // 15:00 UTC
const hours = Array.from({ length: 48 }, (_, i) => Date.UTC(2026, 9, 4, i, 0, 0) / 1000);
const FIXTURE = {
  latitude: 51.5,
  longitude: -0.12,
  utc_offset_seconds: 3600,
  timezone: 'Europe/London',
  current: {
    time: T0 / 1000,
    interval: 900,
    temperature_2m: 14.2,
    weather_code: 3,
    cloud_cover: 100,
    wind_speed_10m: 12.3,
    wind_direction_10m: 240,
    precipitation: 0,
    is_day: 1,
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 10 + (i % 24) / 4),
    weather_code: hours.map((_, i) => (i === 18 ? 61 : i === 20 ? 71 : 2)),
    cloud_cover: hours.map(() => 55),
    precipitation: hours.map((_, i) => (i === 18 ? 1.2 : 0)),
    wind_speed_10m: hours.map(() => 9),
    wind_direction_10m: hours.map(() => 90),
  },
};

describe('conditionFromCode', () => {
  it('folds the WMO code families into scene conditions', () => {
    expect(conditionFromCode(0)).toBe('clear');
    expect(conditionFromCode(1)).toBe('clear');
    expect(conditionFromCode(2)).toBe('partly-cloudy');
    expect(conditionFromCode(3)).toBe('overcast');
    expect(conditionFromCode(45)).toBe('fog');
    expect(conditionFromCode(48)).toBe('fog');
    expect(conditionFromCode(55)).toBe('drizzle');
    expect(conditionFromCode(61)).toBe('rain');
    expect(conditionFromCode(63)).toBe('rain');
    expect(conditionFromCode(65)).toBe('heavy-rain');
    expect(conditionFromCode(81)).toBe('rain');
    expect(conditionFromCode(82)).toBe('heavy-rain');
    expect(conditionFromCode(71)).toBe('snow');
    expect(conditionFromCode(75)).toBe('heavy-snow');
    expect(conditionFromCode(86)).toBe('heavy-snow');
    expect(conditionFromCode(95)).toBe('thunderstorm');
    expect(conditionFromCode(99)).toBe('thunderstorm');
  });

  it('falls back to the cloud cover for unknown codes', () => {
    expect(conditionFromCode(999, 0.1)).toBe('clear');
    expect(conditionFromCode(999, 0.5)).toBe('partly-cloudy');
    expect(conditionFromCode(999, 0.9)).toBe('overcast');
  });
});

describe('describeWeather and formatTemperature', () => {
  it('gives short English labels', () => {
    const now = new Date(T0);
    expect(describeWeather(demoWeather('rain', now))).toBe('Rain');
    expect(describeWeather(demoWeather('rain', now, { code: 61 }))).toBe('Light rain');
    expect(describeWeather(demoWeather('overcast', now))).toBe('Overcast');
    expect(describeWeather(demoWeather('clear', now, { code: 999, cloudCover: 0 }))).toBe('Clear');
  });

  it('rounds and converts temperatures', () => {
    expect(formatTemperature(14.4, 'C')).toBe('14°');
    expect(formatTemperature(0, 'F')).toBe('32°');
    expect(formatTemperature(-2.6, 'C')).toBe('-3°');
  });
});

describe('weatherIntensities', () => {
  const now = new Date(T0);

  it('is all zero without weather', () => {
    const fx = weatherIntensities(null);
    expect(fx).toEqual({ cloud: 0, fog: 0, rain: 0, snow: 0, wind: 0, lightning: 0 });
  });

  it('keeps clear skies nearly cloudless even when the sensor says otherwise', () => {
    const fx = weatherIntensities(demoWeather('clear', now, { cloudCover: 0.9 }));
    expect(fx.cloud).toBeLessThanOrEqual(0.3);
    expect(fx.rain).toBe(0);
  });

  it('forces enough cloud for rain, and rain scales with the code', () => {
    const light = weatherIntensities(demoWeather('rain', now, { code: 61, cloudCover: 0.2 }));
    const heavy = weatherIntensities(demoWeather('heavy-rain', now, { cloudCover: 0.2 }));
    expect(light.cloud).toBeGreaterThanOrEqual(0.8);
    expect(light.rain).toBeGreaterThan(0.2);
    expect(heavy.rain).toBeGreaterThan(light.rain);
    expect(heavy.snow).toBe(0);
  });

  it('measured precipitation nudges the intensity up', () => {
    const dry = weatherIntensities(demoWeather('rain', now, { precipitation: 0 }));
    const wet = weatherIntensities(demoWeather('rain', now, { precipitation: 6 }));
    expect(wet.rain).toBeGreaterThan(dry.rain);
    expect(wet.rain).toBeLessThanOrEqual(1);
  });

  it('snow, fog and lightning come from their conditions', () => {
    expect(weatherIntensities(demoWeather('snow', now)).snow).toBeGreaterThan(0.3);
    expect(weatherIntensities(demoWeather('snow', now)).rain).toBe(0);
    expect(weatherIntensities(demoWeather('fog', now)).fog).toBeGreaterThan(0.7);
    expect(weatherIntensities(demoWeather('thunderstorm', now)).lightning).toBe(1);
    expect(weatherIntensities(demoWeather('overcast', now)).lightning).toBe(0);
  });
});

describe('windDrift', () => {
  it('blows west winds towards the left and east winds towards the right', () => {
    expect(windDrift(30, 270)).toBeLessThan(0);
    expect(windDrift(30, 90)).toBeGreaterThan(0);
  });

  it('is bounded and grows with speed', () => {
    expect(Math.abs(windDrift(200, 270))).toBeLessThanOrEqual(1);
    expect(Math.abs(windDrift(10, 270))).toBeLessThan(Math.abs(windDrift(30, 270)));
    expect(windDrift(0, 270)).toBe(0);
  });
});

describe('parseForecast', () => {
  it('turns a forecast response into a snapshot', () => {
    const snap = parseForecast(FIXTURE, T0 + 60_000, 51.51, -0.13);
    expect(snap).not.toBeNull();
    expect(snap!.current.code).toBe(3);
    expect(snap!.current.cloudCover).toBe(1);
    expect(snap!.current.time).toBe(T0);
    expect(snap!.hourly).toHaveLength(48);
    expect(snap!.hourly[18].code).toBe(61);
    expect(snap!.hourly[18].precipitation).toBe(1.2);
    expect(snap!.hourly[0].cloudCover).toBeCloseTo(0.55, 5);
    expect(snap!.lat).toBe(51.51);
  });

  it('rejects shapes it does not understand', () => {
    expect(parseForecast(null, T0, 0, 0)).toBeNull();
    expect(parseForecast('nope', T0, 0, 0)).toBeNull();
    expect(parseForecast({ error: true, reason: 'bad' }, T0, 0, 0)).toBeNull();
    expect(parseForecast({ current: { time: '2026-10-04T15:00' } }, T0, 0, 0)).toBeNull();
  });

  it('copes with a missing hourly block', () => {
    const snap = parseForecast({ current: FIXTURE.current }, T0, 51.51, -0.13);
    expect(snap).not.toBeNull();
    expect(snap!.hourly).toEqual([]);
  });
});

describe('weatherAt', () => {
  const snap = parseForecast(FIXTURE, T0, 51.51, -0.13)!;

  it('uses the current observation while it is recent', () => {
    const ws = weatherAt(snap, new Date(T0 + 20 * 60_000));
    expect(ws?.source).toBe('current');
    expect(ws?.condition).toBe('overcast');
    expect(ws?.temperature).toBe(14.2);
  });

  it('switches to the nearest hourly slot when the observation is old', () => {
    const later = new Date(T0 + CURRENT_WINDOW_MS + 3 * 3600_000); // about 18:50 UTC
    const ws = weatherAt(snap, later);
    expect(ws?.source).toBe('forecast');
    // 18:50 is nearest to the 19:00 slot, which is partly cloudy in the fixture.
    expect(ws?.code).toBe(2);
    const at18 = weatherAt(snap, new Date(Date.UTC(2026, 9, 4, 18, 10, 0)));
    expect(at18?.code).toBe(61);
    expect(at18?.condition).toBe('rain');
  });

  it('gives up once the forecast has run out', () => {
    expect(weatherAt(snap, new Date(T0 + 5 * 24 * 3600_000))).toBeNull();
    expect(weatherAt(snap, new Date(T0 - 2 * 24 * 3600_000))).toBeNull();
  });
});

describe('isFresh', () => {
  const snap = parseForecast(FIXTURE, T0, 51.51, -0.13)!;

  it('is fresh for a young snapshot at the same place', () => {
    expect(isFresh(snap, new Date(T0 + 10 * 60_000), 51.51, -0.13)).toBe(true);
    expect(isFresh(snap, new Date(T0 + 10 * 60_000), 51.53, -0.1)).toBe(true);
  });

  it('goes stale with age or distance', () => {
    expect(isFresh(snap, new Date(T0 + FRESH_MS + 1000), 51.51, -0.13)).toBe(false);
    expect(isFresh(snap, new Date(T0 + 10 * 60_000), 52.51, -0.13)).toBe(false);
    expect(isFresh(snap, new Date(T0 - 60_000), 51.51, -0.13)).toBe(false);
  });
});

describe('tomorrowOutlook', () => {
  it('reads rain, snow and wind out of tomorrow’s forecast hours, and knows when it cannot', async () => {
    const { tomorrowOutlook, CONDITION_CODES } = await import('../src/core/weather');
    const now = new Date(2026, 9, 7, 15, 0, 0);
    const tomorrow = new Date(2026, 9, 8, 0, 0, 0).getTime();
    const hour = (h: number, code: number, windSpeed = 10, precipitation = 0) => ({
      time: tomorrow + h * 3_600_000, code, cloudCover: 0.5, temperature: 10, windSpeed, windDirection: 200, precipitation,
    });
    const snap = { fetchedAt: now.getTime(), lat: 51.5, lon: -0.1, current: hour(-9, 0), hourly: [] as ReturnType<typeof hour>[] };
    expect(tomorrowOutlook(null, now)).toBeNull();
    expect(tomorrowOutlook(snap, now)).toBeNull();
    const dry = { ...snap, hourly: Array.from({ length: 24 }, (_, h) => hour(h, CONDITION_CODES.clear)) };
    expect(tomorrowOutlook(dry, now)).toEqual({ rain: false, snow: false, wind: false });
    const wet = { ...snap, hourly: dry.hourly.map((s, i) => (i === 14 ? hour(14, CONDITION_CODES.rain) : s)) };
    expect(tomorrowOutlook(wet, now)?.rain).toBe(true);
    const gusty = { ...snap, hourly: dry.hourly.map((s, i) => (i === 9 ? hour(9, CONDITION_CODES.clear, 42) : s)) };
    expect(tomorrowOutlook(gusty, now)?.wind).toBe(true);
    const snowy = { ...snap, hourly: dry.hourly.map((s, i) => (i === 7 ? hour(7, CONDITION_CODES.snow) : s)) };
    expect(tomorrowOutlook(snowy, now)).toEqual({ rain: false, snow: true, wind: false });
  });
});
