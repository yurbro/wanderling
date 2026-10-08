import { describe, expect, it } from 'vitest';
import { KM_PER_HOUR, advance, startJourney } from '../src/core/journey';
import {
  DELIVERY_MAX_MS,
  DELIVERY_MIN_MS,
  deliveredCards,
  deliveryDelayMs,
  demoPostcards,
  describeArrival,
  isDeparture,
  makePostcard,
  missingArrivals,
  pendingCards,
  postcardId,
  postingDistanceKm,
  stampGlyph,
  timeOfDayWord,
} from '../src/core/postcards';
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
    const j = advance(ROUTE, startJourney(ROUTE, T0), T0 + (6 / KM_PER_HOUR + 1) * H).state;
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

describe('slow post', () => {
  const HOME = { name: 'London', lat: 51.51, lon: -0.13 };
  const near: Route = {
    id: 'near',
    name: 'near',
    places: [
      { id: 'a', name: 'Alpha', terrain: 'city', lat: 51.51, lon: -0.13 },
      { id: 'b', name: 'Bravo', terrain: 'hills', lat: 51.25, lon: -0.33 },
      { id: 'c', name: 'Charlie', terrain: 'coast', lat: 35.68, lon: 139.69 },
    ],
    legs: [
      { km: 30, terrain: 'plain' },
      { km: 9600, terrain: 'plain', mode: 'fly' },
    ],
  };

  it('takes three hours from next door and two days from far away', () => {
    expect(deliveryDelayMs(0)).toBe(DELIVERY_MIN_MS);
    expect(deliveryDelayMs(750)).toBeCloseTo((DELIVERY_MIN_MS + DELIVERY_MAX_MS) / 2, -3);
    expect(deliveryDelayMs(1500)).toBe(DELIVERY_MAX_MS);
    expect(deliveryDelayMs(9600)).toBe(DELIVERY_MAX_MS);
    expect(deliveryDelayMs(null)).toBeGreaterThan(DELIVERY_MIN_MS);
    expect(deliveryDelayMs(null)).toBeLessThan(DELIVERY_MAX_MS);
  });

  it('stamps each card with a delivery time by its distance from home', () => {
    expect(postingDistanceKm(near.places[1], HOME)).toBeGreaterThan(30);
    expect(postingDistanceKm(near.places[1], HOME)).toBeLessThan(40);
    expect(postingDistanceKm(near.places[1], null)).toBeNull();
    expect(postingDistanceKm(ROUTE.places[0], HOME)).toBeNull();
    const nearby = makePostcard(near, { placeId: 'b', at: T0 }, LONDON, null, { home: HOME })!;
    expect(nearby.deliverAt! - T0).toBeGreaterThan(DELIVERY_MIN_MS);
    expect(nearby.deliverAt! - T0).toBeLessThan(DELIVERY_MIN_MS + 2 * H);
    const far = makePostcard(near, { placeId: 'c', at: T0 }, LONDON, null, { home: HOME })!;
    expect(far.deliverAt).toBe(T0 + DELIVERY_MAX_MS);
    const now = makePostcard(near, { placeId: 'c', at: T0 }, LONDON, null, { home: HOME, deliverNow: true })!;
    expect(now.deliverAt).toBe(T0);
    const unknown = makePostcard(ROUTE, { placeId: 'a', at: T0 }, LONDON, null)!;
    expect(unknown.deliverAt).toBe(T0 + deliveryDelayMs(null));
  });

  it('keeps a card out of sight until it is delivered, then shows them in order', () => {
    const a = makePostcard(near, { placeId: 'a', at: T0 }, LONDON, null, { home: HOME })!;
    const c = makePostcard(near, { placeId: 'c', at: T0 + 1 * H }, LONDON, null, { home: HOME })!;
    const cards = [a, c];
    expect(deliveredCards(cards, T0 + 1 * H)).toEqual([]);
    expect(pendingCards(cards, T0 + 1 * H)).toHaveLength(2);
    expect(deliveredCards(cards, a.deliverAt!).map((x) => x.placeId)).toEqual(['a']);
    expect(pendingCards(cards, a.deliverAt!).map((x) => x.placeId)).toEqual(['c']);
    // Reopened days later: everything owed is there, in posting order.
    expect(deliveredCards(cards, T0 + 10 * 24 * H).map((x) => x.placeId)).toEqual(['a', 'c']);
    expect(pendingCards(cards, T0 + 10 * 24 * H)).toEqual([]);
  });

  it('treats a card from before slow post as delivered', () => {
    const { deliverAt, ...old } = makePostcard(near, { placeId: 'c', at: T0 }, LONDON, null, { home: HOME })!;
    void deliverAt;
    expect(deliveredCards([old as typeof old & { deliverAt?: number }], T0)).toHaveLength(1);
    expect(pendingCards([old as typeof old & { deliverAt?: number }], T0)).toHaveLength(0);
  });

  it('hands demo cards over at once', () => {
    for (const card of demoPostcards(ROUTE, LONDON, T0)) expect(card.deliverAt).toBe(card.at);
  });
});

describe('the card from where he set out (review 3, ruling 5)', () => {
  it('is handed over the moment the journey begins', () => {
    const j = startJourney(ROUTE, T0);
    const arrival = j.arrivals[0];
    expect(isDeparture(ROUTE, j, arrival)).toBe(true);
    const card = makePostcard(ROUTE, arrival, LONDON, null, { home: { name: 'Far', lat: -33.9, lon: 151.2 }, departure: true })!;
    expect(card.deliverAt).toBe(T0);
    expect(card.departure).toBe(true);
    expect(deliveredCards([card], T0)).toHaveLength(1);
  });

  it('is only the first place of a fresh journey; later places go by slow post', () => {
    const j = advance(ROUTE, startJourney(ROUTE, T0), T0 + (6 / KM_PER_HOUR + 1) * H).state;
    expect(isDeparture(ROUTE, j, j.arrivals[1])).toBe(false);
    // A chained segment starts without arriving at its first place: nothing to hand over.
    const chained = startJourney(ROUTE, T0, { arrived: false });
    expect(isDeparture(ROUTE, chained, { placeId: 'b', at: T0 + 9 * H })).toBe(false);
    const later = makePostcard(ROUTE, j.arrivals[1], LONDON, null, { home: { name: 'Home', lat: 51.5, lon: -0.1 } })!;
    expect(later.deliverAt).toBeGreaterThanOrEqual(later.at + DELIVERY_MIN_MS);
    expect(later.departure).toBeUndefined();
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
