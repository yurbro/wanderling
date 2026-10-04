import type { GeoPoint, Home, Place, Route } from './types';

/**
 * Geography, the pure part: distances, which route is closest to home, the
 * leg that joins home to a route, and the parsers for the two geocoding
 * services (reverse: coordinates to a city name; search: a typed name to
 * candidate cities).
 */

const R = 6371;

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** The route whose first place is nearest; routes without coordinates come last. */
export function nearestRoute(routes: Route[], p: { lat: number; lon: number }): { route: Route; km: number } {
  let best: { route: Route; km: number } | null = null;
  for (const route of routes) {
    const first = route.places[0];
    const km = first && typeof first.lat === 'number' && typeof first.lon === 'number' ? haversineKm(p, { lat: first.lat, lon: first.lon }) : Infinity;
    if (!best || km < best.km) best = { route, km };
  }
  if (!best) throw new Error('no routes');
  return best;
}

/** Closer than this and you already live at the route's first place. */
export const HOME_LEG_MIN_KM = 3;
/** Farther than this and the walk to the route would take weeks; start on the route instead. */
export const HOME_LEG_MAX_KM = 400;

export function homeNote(name: string): string {
  return `Left ${name} before the streets woke up.`;
}

/**
 * The route the wanderer actually walks: the base route with the person's
 * city in front of it when it is a reasonable walk away. The id stays the
 * base route's, so saved journeys and postcards keep working.
 */
export function routeFromHome(base: Route, home: Home | null | undefined): Route {
  if (!home) return base;
  const first = base.places[0];
  if (!first || typeof first.lat !== 'number' || typeof first.lon !== 'number') return base;
  const km = haversineKm(home, { lat: first.lat, lon: first.lon });
  if (km < HOME_LEG_MIN_KM || km > HOME_LEG_MAX_KM) return base;
  const homePlace: Place = {
    id: 'home',
    name: home.name,
    region: home.region,
    terrain: 'city',
    lat: home.lat,
    lon: home.lon,
    note: homeNote(home.name),
  };
  return {
    ...base,
    places: [homePlace, ...base.places],
    legs: [{ km: Math.round(km), terrain: 'plain' }, ...base.legs],
  };
}

/* ------------------------------------------------------------- geocoding */

export interface CityResult {
  name: string;
  region?: string;
  lat: number;
  lon: number;
}

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** BigDataCloud's reverse geocode: city, or the locality, or the region. */
export function parseReverseGeocode(json: unknown): { name: string; region?: string } | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const name = [j.city, j.locality, j.principalSubdivision].find(str);
  if (!name) return null;
  const region = [j.countryName, j.principalSubdivision].find((v): v is string => str(v) && v !== name);
  return region ? { name, region } : { name };
}

/** Open-Meteo's geocoding search: up to a handful of named places. */
export function parseCitySearch(json: unknown): CityResult[] {
  if (!json || typeof json !== 'object') return [];
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: CityResult[] = [];
  for (const r of results) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (!str(o.name) || !num(o.latitude) || !num(o.longitude)) continue;
    const parts = [o.admin1, o.country].filter((v): v is string => str(v) && v !== o.name);
    out.push({
      name: o.name,
      region: parts.length ? parts.join(', ') : undefined,
      lat: Math.round(o.latitude * 100) / 100,
      lon: Math.round(o.longitude * 100) / 100,
    });
  }
  return out;
}

/** A GeoPoint the app can use as home, or null when it is only the built-in default. */
export function homeFrom(p: GeoPoint, isDefault: boolean): Home | null {
  if (isDefault) return null;
  return { name: p.name && p.name !== 'Your sky' ? p.name : 'Home', region: p.region, lat: p.lat, lon: p.lon };
}
