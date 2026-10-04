import { describe, expect, it } from 'vitest';
import { WALK_MAX_KM, haversineKm, homeFrom, nearestRoute, parseCitySearch, parseReverseGeocode, routeFromHome, transferMode } from '../src/core/geo';
import { startJourney } from '../src/core/journey';
import { isJourneyState } from '../src/data/journeyStore';
import { ROUTES, TO_THE_SEA } from '../src/data/routes';

describe('haversineKm', () => {
  it('measures London to Paris at about 340 km', () => {
    const km = haversineKm({ lat: 51.51, lon: -0.13 }, { lat: 48.86, lon: 2.35 });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
    expect(haversineKm({ lat: 10, lon: 10 }, { lat: 10, lon: 10 })).toBe(0);
  });
});

describe('nearestRoute', () => {
  it('picks the route that starts closest', () => {
    expect(nearestRoute(ROUTES, { lat: 52.48, lon: -1.9 }).route.id).toBe(TO_THE_SEA.id); // Birmingham
    expect(nearestRoute(ROUTES, { lat: 35.68, lon: 139.69 }).route.id).toContain('tokyo');
    expect(nearestRoute(ROUTES, { lat: 48.86, lon: 2.35 }).route.id).toContain('paris');
  });

  it('every bundled route is well formed', () => {
    for (const r of ROUTES) {
      expect(r.legs).toHaveLength(r.places.length - 1);
      expect(new Set(r.places.map((p) => p.id)).size).toBe(r.places.length);
      for (const p of r.places) {
        expect(typeof p.lat).toBe('number');
        expect(typeof p.lon).toBe('number');
      }
      for (const leg of r.legs) expect(leg.km).toBeGreaterThan(0);
    }
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
  });
});

describe('routeFromHome', () => {
  const brighton = { name: 'Brighton', region: 'United Kingdom', lat: 50.82, lon: -0.14 };

  it('adds a home place and a real-distance leg in front of the route', () => {
    const r = routeFromHome(TO_THE_SEA, brighton);
    expect(r.id).toBe(TO_THE_SEA.id);
    expect(r.places[0].id).toBe('home');
    expect(r.places[0].name).toBe('Brighton');
    expect(r.places[0].note).toContain('Brighton');
    expect(r.places[1].id).toBe('london');
    expect(r.legs).toHaveLength(TO_THE_SEA.legs.length + 1);
    expect(r.legs[0].km).toBeGreaterThan(70);
    expect(r.legs[0].km).toBeLessThan(90);
    expect(r.legs[0].mode).toBe('walk');
  });

  it('leaves the route alone when home is on it, and flies in when it is far', () => {
    expect(routeFromHome(TO_THE_SEA, null)).toBe(TO_THE_SEA);
    expect(routeFromHome(TO_THE_SEA, { name: 'London', lat: 51.51, lon: -0.13 })).toBe(TO_THE_SEA);
    const far = routeFromHome(TO_THE_SEA, { name: 'Tokyo', lat: 35.68, lon: 139.69 });
    expect(far.places[0].name).toBe('Tokyo');
    expect(far.legs[0].mode).toBe('fly');
    expect(far.legs[0].km).toBeGreaterThan(9000);
    const train = routeFromHome(TO_THE_SEA, { name: 'Berlin', lat: 52.52, lon: 13.4 });
    expect(train.legs[0].mode).toBe('ride');
    expect(WALK_MAX_KM).toBeGreaterThan(300);
    expect(transferMode(100)).toBe('walk');
    expect(transferMode(1000)).toBe('ride');
    expect(transferMode(5000)).toBe('fly');
  });

  it('round-trips through the journey store with home attached', () => {
    const s = { ...startJourney(TO_THE_SEA, 1000), home: brighton };
    expect(isJourneyState(s)).toBe(true);
    expect(isJourneyState({ ...s, home: { name: 5 } })).toBe(false);
    expect(isJourneyState({ ...s, home: null })).toBe(true);
  });
});

describe('geocoding parsers', () => {
  it('reads a reverse geocode result', () => {
    expect(parseReverseGeocode({ city: 'Brighton', principalSubdivision: 'England', countryName: 'United Kingdom' })).toEqual({ name: 'Brighton', region: 'United Kingdom' });
    expect(parseReverseGeocode({ city: '', locality: 'Hove', countryName: 'United Kingdom' })).toEqual({ name: 'Hove', region: 'United Kingdom' });
    expect(parseReverseGeocode({ principalSubdivision: 'Hokkaido' })).toEqual({ name: 'Hokkaido' });
    expect(parseReverseGeocode({})).toBeNull();
    expect(parseReverseGeocode('nope')).toBeNull();
  });

  it('reads a city search result and rounds coordinates to two decimals', () => {
    const json = {
      results: [
        { name: 'Tokyo', latitude: 35.6895, longitude: 139.69171, country: 'Japan', admin1: 'Tokyo' },
        { name: 'Bad', latitude: 'x' },
        { name: 'Paris', latitude: 48.85341, longitude: 2.3488, country: 'France', admin1: 'Île-de-France' },
      ],
    };
    expect(parseCitySearch(json)).toEqual([
      { name: 'Tokyo', region: 'Japan', lat: 35.69, lon: 139.69 },
      { name: 'Paris', region: 'Île-de-France, France', lat: 48.85, lon: 2.35 },
    ]);
    expect(parseCitySearch({})).toEqual([]);
    expect(parseCitySearch(null)).toEqual([]);
  });

  it('turns a located point into a home, never the built-in default', () => {
    expect(homeFrom({ lat: 51.51, lon: -0.13, name: 'London' }, true)).toBeNull();
    expect(homeFrom({ lat: 50.82, lon: -0.14, name: 'Your sky' }, false)).toEqual({ name: 'Home', region: undefined, lat: 50.82, lon: -0.14 });
    expect(homeFrom({ lat: 50.82, lon: -0.14, name: 'Brighton', region: 'UK' }, false)).toEqual({ name: 'Brighton', region: 'UK', lat: 50.82, lon: -0.14 });
  });
});
