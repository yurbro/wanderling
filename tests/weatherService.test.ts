import { describe, expect, it, vi } from 'vitest';
import { WeatherService, fetchPlaceWeather, forecastUrl, placeWeatherUrl } from '../src/data/weather';
import { parseForecast } from '../src/core/weather';

const LONDON = { lat: 51.51, lon: -0.13, name: 'London' };
const T0 = Date.UTC(2026, 9, 4, 15, 0, 0);

function response(code: number, cloud = 100): unknown {
  const hours = Array.from({ length: 48 }, (_, i) => Date.UTC(2026, 9, 4, i, 0, 0) / 1000);
  return {
    current: {
      time: T0 / 1000,
      temperature_2m: 12,
      weather_code: code,
      cloud_cover: cloud,
      wind_speed_10m: 10,
      wind_direction_10m: 200,
      precipitation: 0,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => 11),
      weather_code: hours.map(() => code),
      cloud_cover: hours.map(() => cloud),
      precipitation: hours.map(() => 0),
      wind_speed_10m: hours.map(() => 10),
      wind_direction_10m: hours.map(() => 200),
    },
  };
}

const okFetch = (body: unknown): typeof fetch =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

describe('forecastUrl', () => {
  it('asks Open-Meteo for coarse coordinates, unix times and two days', () => {
    const u = new URL(forecastUrl({ lat: 51.5074, lon: -0.1278 }));
    expect(u.hostname).toBe('api.open-meteo.com');
    expect(u.searchParams.get('latitude')).toBe('51.51');
    expect(u.searchParams.get('longitude')).toBe('-0.13');
    expect(u.searchParams.get('timeformat')).toBe('unixtime');
    expect(u.searchParams.get('forecast_days')).toBe('2');
    expect(u.searchParams.get('current')).toContain('weather_code');
    expect(u.searchParams.get('hourly')).toContain('weather_code');
  });
});

describe('WeatherService', () => {
  it('starts empty and fills from the network', async () => {
    const onChange = vi.fn();
    const fetchImpl = okFetch(response(61));
    const svc = new WeatherService(onChange, null, fetchImpl);
    const now = new Date(T0 + 60_000);
    expect(svc.current(now)).toBeNull();
    await svc.refresh(LONDON, now);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(svc.status).toBe('ok');
    expect(svc.current(now)?.condition).toBe('rain');
    expect(svc.current(now)?.source).toBe('current');
  });

  it('does not refetch while the cache is fresh for the same place', async () => {
    const fetchImpl = okFetch(response(3));
    const initial = parseForecast(response(3), T0, LONDON.lat, LONDON.lon)!;
    const svc = new WeatherService(() => {}, initial, fetchImpl);
    await svc.refresh(LONDON, new Date(T0 + 10 * 60_000));
    expect(fetchImpl).not.toHaveBeenCalled();
    // Moving to another city invalidates it.
    await svc.refresh({ lat: 35.68, lon: 139.69 }, new Date(T0 + 10 * 60_000));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps the old snapshot when the network fails', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const initial = parseForecast(response(71, 90), T0, LONDON.lat, LONDON.lon)!;
    const svc = new WeatherService(() => {}, initial, failing);
    const later = new Date(T0 + 3 * 3600_000);
    await svc.refresh(LONDON, later);
    expect(svc.status).toBe('offline');
    const ws = svc.current(later);
    expect(ws?.condition).toBe('snow');
    expect(ws?.source).toBe('forecast');
  });

  it('treats an http error like a failure', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    const svc = new WeatherService(() => {}, null, bad);
    await svc.refresh(LONDON, new Date(T0));
    expect(svc.status).toBe('offline');
    expect(svc.current(new Date(T0))).toBeNull();
  });

  it('shares one in-flight request', async () => {
    const fetchImpl = okFetch(response(0, 5));
    const svc = new WeatherService(() => {}, null, fetchImpl);
    await Promise.all([svc.refresh(LONDON, new Date(T0)), svc.refresh(LONDON, new Date(T0))]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('his weather at a place (the two skies)', () => {
  it('asks for the coarse spot and enough days back to reach the arrival', () => {
    const u = new URL(placeWeatherUrl({ lat: 50.8229, lon: -0.1363 }, T0 - 2.5 * 86_400_000, T0));
    expect(u.searchParams.get('latitude')).toBe('50.82');
    expect(u.searchParams.get('past_days')).toBe('4');
    expect(new URL(placeWeatherUrl({ lat: 1, lon: 2 }, T0 - 400 * 86_400_000, T0)).searchParams.get('past_days')).toBe('92');
  });

  it('picks the hour of arrival, and is quietly null offline', async () => {
    const there = await fetchPlaceWeather({ lat: 50.82, lon: -0.14 }, Date.UTC(2026, 9, 4, 9, 10), okFetch(response(63)), T0);
    expect(there).toEqual({ condition: 'rain', code: 63, temperature: 11 });
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchPlaceWeather({ lat: 50.82, lon: -0.14 }, T0, failing, T0)).toBeNull();
  });
});
