import { parseCitySearch, parseReverseGeocode, type CityResult } from '../core/geo';
import type { GeoPoint } from '../core/types';

/**
 * Two free geocoding services, both keyless and happy with browser calls.
 * Only coarse (two decimal) coordinates are ever sent. Both fail quietly:
 * no name is not an error, the HUD just keeps saying "Your sky".
 */

const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const SEARCH = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 8000;

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`geocode http ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The city for a point, or null. */
export async function reverseGeocode(p: GeoPoint, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<{ name: string; region?: string } | null> {
  try {
    const q = new URLSearchParams({ latitude: p.lat.toFixed(2), longitude: p.lon.toFixed(2), localityLanguage: 'en' });
    return parseReverseGeocode(await getJson(`${REVERSE}?${q}`, fetchImpl));
  } catch (err) {
    console.warn('[wanderling] reverse geocode unavailable', err);
    return null;
  }
}

/** Cities matching a typed name, up to five. */
export async function searchCity(query: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<CityResult[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  try {
    const q = new URLSearchParams({ name, count: '5', language: 'en', format: 'json' });
    return parseCitySearch(await getJson(`${SEARCH}?${q}`, fetchImpl));
  } catch (err) {
    console.warn('[wanderling] city search unavailable', err);
    return [];
  }
}
