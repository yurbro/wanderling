import { describe, expect, it } from 'vitest';
import { buildSegmentRoute, nextSegment } from '../src/core/chain';
import { haversineKm } from '../src/core/geo';
import { REST_MS, advance, describeJourney, locate, startJourney } from '../src/core/journey';
import {
  NIGHT_TRAIN_MAX_KM,
  NIGHT_TRAIN_MIN_KM,
  bearingTo,
  dayAt,
  outsetDestination,
  planOutset,
  travel,
  withOutset,
} from '../src/core/outset';
import type { Home, JourneyState } from '../src/core/types';
import { isJourneyState } from '../src/data/journeyStore';
import { ROUTES } from '../src/data/routes';

const H = 3_600_000;
const MIN = 60_000;
const LONDON: Home = { name: 'London', region: 'United Kingdom', lat: 51.51, lon: -0.13 };
const SHANGHAI: Home = { name: 'Shanghai', region: 'China', lat: 31.23, lon: 121.47 };
const BERLIN: Home = { name: 'Berlin', region: 'Germany', lat: 52.52, lon: 13.4 };

/** A fresh journey with its going-out stretch, as main.ts makes one. */
function fresh(origin: Home, start: number) {
  const base = outsetDestination(ROUTES, origin);
  const first = base.places[0];
  const outset = planOutset(origin, { lat: first.lat!, lon: first.lon! }, start);
  const route = withOutset(base, outset);
  const journey: JourneyState = { ...startJourney(route, start), home: origin, from: null, walked: [], outset };
  return { base, route, journey, outset };
}

const at = (route: ReturnType<typeof fresh>['route'], journey: JourneyState, t: number) => {
  const state = advance(route, journey, t).state;
  return { state, pos: locate(route, state, t) };
};

describe('the going-out stretch (ruling 14)', () => {
  it('always begins on foot, out of the front door', () => {
    for (const origin of [LONDON, SHANGHAI, BERLIN]) {
      const start = new Date(2026, 9, 8, 10, 0).getTime();
      const { route, journey } = fresh(origin, start);
      expect(route.places[0].id).toBe('home');
      expect(route.places[1].id).toBe('station');
      expect(route.legs[0].mode).toBe('walk');
      const { pos } = at(route, journey, start + MIN);
      expect(pos.mode).toBe('walk');
      expect(pos.to!.id).toBe('station');
    }
  });

  it('reaches the little station at 8:00 on day 3, whatever hour it began, sleep counted', () => {
    for (const [h, m] of [[0, 30], [9, 0], [14, 45], [23, 30]]) {
      const start = new Date(2026, 9, 8, h, m).getTime();
      const { route, journey, outset } = fresh(LONDON, start);
      const due = dayAt(start, 3, 8);
      expect(outset.walkKm).toBeGreaterThan(40);
      expect(outset.walkKm).toBeLessThan(80);
      expect(at(route, journey, due - 2 * MIN).state.arrivals.map((a) => a.placeId)).toEqual(['home']);
      expect(at(route, journey, due + 2 * MIN).state.arrivals.map((a) => a.placeId)).toEqual(['home', 'station']);
    }
  });

  it('boards the night train at 20:00 on day 3 and gets in at 6:00 on day 5', () => {
    const start = new Date(2026, 9, 8, 9, 0).getTime();
    const { base, route, journey } = fresh(LONDON, start);
    expect(at(route, journey, dayAt(start, 3, 19)).pos.resting).toBe(true);
    const evening = at(route, journey, dayAt(start, 3, 21));
    expect(evening.pos.mode).toBe('ride');
    expect(describeJourney(evening.pos, dayAt(start, 3, 21))).toBe(`On the night train to ${base.places[0].name} · in two dawns`);
    const day4 = at(route, journey, dayAt(start, 4, 14));
    expect(day4.pos.mode).toBe('ride');
    expect(describeJourney(day4.pos, dayAt(start, 4, 14))).toMatch(/in at dawn tomorrow$/);
    expect(at(route, journey, dayAt(start, 5, 6) - 2 * MIN).state.arrivals).toHaveLength(2);
    const dawn = at(route, journey, dayAt(start, 5, 6) + 2 * MIN);
    expect(dawn.state.arrivals.map((a) => a.placeId)).toEqual(['home', 'station', base.places[0].id]);
    expect(dawn.pos.resting).toBe(true);
    // Then the route proper, on foot.
    expect(at(route, journey, dayAt(start, 5, 6) + REST_MS + H).pos.mode).toBe('walk');
  });

  it('takes the train somewhere worth a train: not the route on the doorstep', () => {
    expect(outsetDestination(ROUTES, LONDON).id).toBe('paris-seine-v1');
    expect(outsetDestination(ROUTES, SHANGHAI).id).toBe('tokyo-hot-springs-v1');
    for (const origin of [LONDON, SHANGHAI, BERLIN]) {
      const first = outsetDestination(ROUTES, origin).places[0];
      expect(haversineKm(origin, { lat: first.lat!, lon: first.lon! })).toBeGreaterThanOrEqual(NIGHT_TRAIN_MIN_KM);
    }
  });

  it('puts the station a walk away, towards where the train goes', () => {
    const start = new Date(2026, 9, 8, 9, 0).getTime();
    const { base, outset } = fresh(LONDON, start);
    const crow = haversineKm(LONDON, outset.station);
    expect(crow).toBeGreaterThan(outset.walkKm * 0.7);
    expect(crow).toBeLessThan(outset.walkKm * 0.9);
    const first = base.places[0];
    const towards = bearingTo(LONDON, { lat: first.lat!, lon: first.lon! });
    expect(Math.abs(bearingTo(LONDON, outset.station) - towards)).toBeLessThan(3);
  });

  it('flies instead when no train could reach', () => {
    const outset = planOutset(LONDON, null, new Date(2026, 9, 8, 9, 0).getTime());
    const far = { ...ROUTES[0], places: [{ ...ROUTES[0].places[0], lat: -33.87, lon: 151.21 }, ...ROUTES[0].places.slice(1)] };
    const route = withOutset(far, outset);
    expect(route.legs[1].km).toBeGreaterThan(NIGHT_TRAIN_MAX_KM);
    expect(route.legs[1].mode).toBe('fly');
    expect(route.legs[1].hours).toBeUndefined();
  });

  it('is saved with the journey and rebuilt the same, and the chain carries on after it', () => {
    const start = new Date(2026, 9, 8, 9, 0).getTime();
    const { base, route, journey } = fresh(BERLIN, start);
    const saved: unknown = JSON.parse(JSON.stringify(journey));
    expect(isJourneyState(saved)).toBe(true);
    expect(isJourneyState({ ...(saved as object), outset: { origin: BERLIN, station: { lat: 1 }, walkKm: 3, trainHours: 3 } })).toBe(false);
    expect(buildSegmentRoute(saved as JourneyState, ROUTES)).toEqual(route);
    // A year on: the stretch, the train and the route are done; the next segment is an ordinary one.
    const done = advance(route, journey, start + 365 * 24 * H).state;
    const next = nextSegment(done, route, ROUTES, start + 365 * 24 * H);
    expect(next.journey.outset).toBeUndefined();
    expect(next.journey.walked).toContain(base.id);
  });

  it('knows its way around the globe', () => {
    const p = travel({ lat: 0, lon: 0 }, 90, 111.2);
    expect(p.lat).toBeCloseTo(0, 1);
    expect(p.lon).toBeCloseTo(1, 1);
    expect(travel({ lat: 10, lon: 179.9 }, 90, 50).lon).toBeLessThan(-179);
  });
});
