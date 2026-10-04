import { computeMoon, computeSun } from './astro';
import type { GeoPoint, WeatherState, WorldState } from './types';

/** Assemble the WorldState for a moment in time at a place. Pure, no I/O. */
export function buildWorldState(
  now: Date,
  location: GeoPoint,
  weather: WeatherState | null = null,
): WorldState {
  return {
    now,
    location,
    sun: computeSun(now, location.lat, location.lon),
    moon: computeMoon(now, location.lat, location.lon),
    weather,
  };
}
