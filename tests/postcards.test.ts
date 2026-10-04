import { describe, expect, it } from 'vitest';
import { advance, startJourney } from '../src/core/journey';
import { demoPostcards, describeArrival, makePostcard, missingArrivals, postcardId, stampGlyph, timeOfDayWord } from '../src/core/postcards';
import { demoWeather } from '../src/core/weather';
import type { Route } from '../src/core/types';

const LONDON = { lat: 51.51, lon: -0.13, name: 'London' };
const H = 3_600_000;
// A local-time afternoon, so the caption test does not depend on the runner's zone.
const T0 = new Date(2026, 9, 4, 15, 20, 0).getTime();

const ROUTE: Route = {
  id: 'r',
  name: 'r',
  places: [
    { id: 'a', name: 'Alpha', region: 'Here', terrain: 'city', note: 'Off we go.' },
    { id: 'b', name: 'Bravo', terrain: 'coast' },
  ],
  legs: [{ km: 6, terrain: 'plain' }],
};

describe('missingArrivals', () => {
  it('lists arrivals that have no card yet, in order', () => {
    const j = advance(ROUTE, startJourney(ROUTE, T0), T0 + 5 * H).state;
    expect(j.arrivals.map((a) => a.placeId)).toEqual(['a', 'b']);
    const none = missingArrivals(ROUTE, j, []);
    expect(none.map((a) => a.placeId)).toEqual(['a', 'b']);
    const first = makePostcard(ROUTE, j.arrivals[0], LONDON, null)!;
    const rest = missingArrivals(ROUTE, j, [first]);
    expect(rest.map((a) => a.placeId)).toEqual(['b']);
    expect(postcardId(ROUTE.id, j.arrivals[1])).toBe(`r:b:${j.arrivals[1].at}`);
  });
});

describe('makePostcard', () => {
  it('captures place, note, weather and the colors of that moment', () => {
    const arrival = { placeId: 'b', at: T0 };
    const card = makePostcard(ROUTE, arrival, LONDON, demoWeather('rain', new Date(T0), { temperature: 11 }))!;
    expect(card.placeName).toBe('Bravo');
    expect(card.note).toBe('Arrived in Bravo.');
    expect(card.weather?.condition).toBe('rain');
    expect(card.seaAmount).toBe(1);
    expect(card.colors.skyTop).toBeGreaterThan(0);
    expect(typeof card.darkInk).toBe('boolean');
    const noted = makePostcard(ROUTE, { placeId: 'a', at: T0 }, LONDON, null)!;
    expect(noted.note).toBe('Off we go.');
    expect(noted.weather).toBeNull();
    expect(noted.seaAmount).toBe(0);
  });

  it('returns null for a place that is not on the route', () => {
    expect(makePostcard(ROUTE, { placeId: 'zzz', at: T0 }, LONDON, null)).toBeNull();
  });

  it('gives a darker sky at night than at noon', () => {
    const noon = makePostcard(ROUTE, { placeId: 'a', at: Date.UTC(2026, 5, 21, 12, 0, 0) }, LONDON, null)!;
    const night = makePostcard(ROUTE, { placeId: 'a', at: Date.UTC(2026, 0, 15, 0, 30, 0) }, LONDON, null)!;
    expect(night.colors.skyTop).toBeLessThan(noon.colors.skyTop);
    expect(noon.darkInk).toBe(true);
    expect(night.darkInk).toBe(false);
  });
});

describe('captions and stamps', () => {
  it('names the time of day', () => {
    expect(timeOfDayWord(7)).toBe('morning');
    expect(timeOfDayWord(13)).toBe('afternoon');
    expect(timeOfDayWord(19)).toBe('evening');
    expect(timeOfDayWord(23)).toBe('night');
    expect(timeOfDayWord(3)).toBe('night');
  });

  it('describes the arrival with or without weather', () => {
    const wet = makePostcard(ROUTE, { placeId: 'b', at: T0 }, LONDON, demoWeather('rain', new Date(T0), { temperature: 11.4 }))!;
    expect(describeArrival(wet)).toBe('A rainy afternoon · 11°');
    expect(describeArrival(wet, 'F')).toBe('A rainy afternoon · 53°');
    const dry = makePostcard(ROUTE, { placeId: 'a', at: T0 }, LONDON, null)!;
    expect(describeArrival(dry)).toBe('Afternoon');
    expect(stampGlyph(wet)).toBe('☂');
    expect(stampGlyph(dry)).toBe('✦');
    const snow = makePostcard(ROUTE, { placeId: 'a', at: T0 }, LONDON, demoWeather('snow', new Date(T0)))!;
    expect(stampGlyph(snow)).toBe('❄');
  });
});

describe('demoPostcards', () => {
  it('makes a few varied sample cards', () => {
    const cards = demoPostcards(ROUTE, LONDON, T0);
    expect(cards.length).toBe(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(cards.some((c) => c.weather?.condition === 'rain')).toBe(true);
  });
});
