import type { GeoPoint, Home, LegMode, Place, Route } from './types';

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

/** Closer than this and you already stand at the route's first place. */
export const HOME_LEG_MIN_KM = 3;
/** Up to here the wanderer walks to the route; beyond, a train; far beyond, a plane. */
export const WALK_MAX_KM = 400;
export const RIDE_MAX_KM = 1500;

export function transferMode(km: number): LegMode {
  if (km <= WALK_MAX_KM) return 'walk';
  if (km <= RIDE_MAX_KM) return 'ride';
  return 'fly';
}

export function homeNote(name: string): string {
  return `Left ${name} before the streets woke up.`;
}

/**
 * The route as actually travelled: the base route with a starting point in
 * front of it (the person's city, or where the last route ended), joined by
 * a leg of real distance, on foot when near, by train or plane when far.
 * The id stays the base route's, so saved journeys and postcards keep working.
 */
export function withTransfer(base: Route, start: Home | null | undefined, startId = 'home', note?: string): Route {
  if (!start) return base;
  const first = base.places[0];
  if (!first || typeof first.lat !== 'number' || typeof first.lon !== 'number') return base;
  const km = haversineKm(start, { lat: first.lat, lon: first.lon });
  if (km < HOME_LEG_MIN_KM) return base;
  const startPlace: Place = {
    id: startId,
    name: start.name,
    region: start.region,
    terrain: 'city',
    lat: start.lat,
    lon: start.lon,
    note: note ?? homeNote(start.name),
  };
  return {
    ...base,
    places: [startPlace, ...base.places],
    legs: [{ km: Math.round(km), terrain: 'plain', mode: transferMode(km) }, ...base.legs],
  };
}

/** The route from the person's home city. */
export function routeFromHome(base: Route, home: Home | null | undefined): Route {
  return withTransfer(base, home, 'home');
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
