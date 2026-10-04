import type { GeoPoint } from '../core/types';

/** Where the sky is drawn from until the person shares their location. */
export const DEFAULT_LOCATION: GeoPoint = { lat: 51.51, lon: -0.13, name: 'London' };

const KEY = 'wanderling.location';

/** Coarse coordinates only: two decimals is roughly a kilometre, plenty for the sky. */
export function coarsen(p: GeoPoint): GeoPoint {
  return { ...p, lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
}

export function loadLocation(): GeoPoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as GeoPoint;
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

export function saveLocation(p: GeoPoint): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(coarsen(p)));
  } catch {
    // Storage can be unavailable in private mode; the sky still works.
  }
}

export function requestLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(
          coarsen({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your sky' }),
        );
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
