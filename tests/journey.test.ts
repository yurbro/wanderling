import { describe, expect, it } from 'vitest';
import {
  KM_PER_HOUR,
  REST_MS,
  addBonusKm,
  advance,
  describeJourney,
  landAt,
  locate,
  placeKms,
  startJourney,
  totalKm,
} from '../src/core/journey';
import type { Route } from '../src/core/types';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 4, 8, 0, 0);

const ROUTE: Route = {
  id: 'test',
  name: 'Test route',
  places: [
    { id: 'a', name: 'Alpha', terrain: 'city' },
    { id: 'b', name: 'Bravo', terrain: 'hills' },
    { id: 'c', name: 'Charlie', terrain: 'coast', note: 'The sea!' },
  ],
  legs: [
    { km: 8, terrain: 'plain' },
    { km: 12, terrain: 'hills' },
  ],
};

describe('route helpers', () => {
  it('accumulates place kilometres', () => {
    expect(placeKms(ROUTE)).toEqual([0, 8, 20]);
    expect(totalKm(ROUTE)).toBe(20);
  });
});

describe('startJourney and locate', () => {
  it('starts at the first place, already counted as reached', () => {
    const s = startJourney(ROUTE, T0);
    expect(s.km).toBe(0);
    expect(s.arrivals).toEqual([{ placeId: 'a', at: T0 }]);
    const pos = locate(ROUTE, s, T0);
    expect(pos.from.id).toBe('a');
    expect(pos.to?.id).toBe('b');
    expect(pos.kmToNext).toBe(8);
    expect(pos.resting).toBe(false);
    expect(pos.finished).toBe(false);
  });
});

describe('advance', () => {
  it('walks at the fixed pace with no arrivals mid-leg', () => {
    const s = startJourney(ROUTE, T0);
    const { state, arrived } = advance(ROUTE, s, T0 + 1 * H);
    expect(state.km).toBeCloseTo(KM_PER_HOUR, 6);
    expect(arrived).toEqual([]);
    const pos = locate(ROUTE, state, T0 + 1 * H);
    expect(pos.kmIntoLeg).toBeCloseTo(4, 6);
    expect(pos.fraction).toBeCloseTo(0.5, 6);
  });

  it('arrives at the exact moment and then rests', () => {
    const s = startJourney(ROUTE, T0);
    const legHours = 8 / KM_PER_HOUR; // 2 h
    const { state, arrived } = advance(ROUTE, s, T0 + 3 * H);
    expect(arrived.map((p) => p.id)).toEqual(['b']);
    expect(state.arrivals[1]).toEqual({ placeId: 'b', at: T0 + legHours * H });
    expect(state.km).toBe(8);
    expect(state.restingUntil).toBe(T0 + legHours * H + REST_MS);
    const pos = locate(ROUTE, state, T0 + 3 * H);
    expect(pos.resting).toBe(true);
    expect(pos.from.id).toBe('b');
    expect(describeJourney(pos)).toBe('Resting in Bravo');
  });

  it('sets off again after the rest and reaches the end', () => {
    const s = startJourney(ROUTE, T0);
    const restH = REST_MS / H;
    // Leg 1: 2 h, rest, leg 2: 3 h.
    const arriveC = T0 + (2 + restH + 3) * H;
    const early = advance(ROUTE, s, arriveC - 0.5 * H);
    expect(early.arrived.map((p) => p.id)).toEqual(['b']);
    expect(locate(ROUTE, early.state, arriveC - 0.5 * H).kmToNext).toBeCloseTo(2, 6);
    const done = advance(ROUTE, early.state, arriveC + 1 * H);
    expect(done.arrived.map((p) => p.id)).toEqual(['c']);
    expect(done.state.arrivals[2].at).toBe(arriveC);
    expect(done.state.km).toBe(20);
    const pos = locate(ROUTE, done.state, arriveC + 1 * H);
    expect(pos.finished).toBe(true);
    expect(describeJourney(pos)).toBe("Journey's end: Charlie");
    // Staying put afterwards.
    const later = advance(ROUTE, done.state, arriveC + 50 * H);
    expect(later.state.km).toBe(20);
    expect(later.arrived).toEqual([]);
  });

  it('replays a long absence in one go, with every rest honoured', () => {
    const s = startJourney(ROUTE, T0);
    const { state, arrived } = advance(ROUTE, s, T0 + 100 * H);
    expect(arrived.map((p) => p.id)).toEqual(['b', 'c']);
    const [a, b, c] = state.arrivals;
    expect(b.at - a.at).toBe(2 * H);
    expect(c.at - b.at).toBe(REST_MS + 3 * H);
  });

  it('never walks backwards when the clock does', () => {
    const s = startJourney(ROUTE, T0);
    const ahead = advance(ROUTE, s, T0 + 1 * H).state;
    const back = advance(ROUTE, ahead, T0 - 5 * H);
    expect(back.state.km).toBeCloseTo(ahead.km, 6);
    expect(back.arrived).toEqual([]);
  });

  it('describes the walk', () => {
    const s = startJourney(ROUTE, T0);
    const pos = locate(ROUTE, advance(ROUTE, s, T0 + 0.5 * H).state, T0 + 0.5 * H);
    expect(describeJourney(pos)).toBe('Walking to Bravo · 6 km to go');
    const near = locate(ROUTE, advance(ROUTE, s, T0 + 1.9 * H).state, T0 + 1.9 * H);
    expect(describeJourney(near)).toBe('Walking to Bravo · almost there');
  });
});

describe('addBonusKm', () => {
  it('pushes the wanderer ahead and collects the places crossed', () => {
    const s = startJourney(ROUTE, T0);
    const { state, arrived } = addBonusKm(ROUTE, s, 10, T0 + 0.25 * H);
    expect(arrived.map((p) => p.id)).toEqual(['b']);
    expect(state.km).toBeCloseTo(11, 6);
    expect(state.bonusKm).toBe(10);
  });
});

describe('landAt', () => {
  it('uses the leg terrain in the middle and blends near the ends', () => {
    const s = startJourney(ROUTE, T0);
    const mid = locate(ROUTE, advance(ROUTE, s, T0 + 1 * H).state, T0 + 1 * H);
    expect(landAt(ROUTE, mid)).toEqual({ relief: 0.4, sea: 0 });
    // Leg 2 is hills (relief 1) leading to a coast (sea 1): near the end the sea shows.
    const restH = REST_MS / H;
    const nearEnd = advance(ROUTE, s, T0 + (2 + restH + 2.9) * H).state;
    const pos = locate(ROUTE, nearEnd, T0 + (2 + restH + 2.9) * H);
    expect(pos.to?.id).toBe('c');
    expect(pos.fraction).toBeGreaterThan(0.95);
    const land = landAt(ROUTE, pos);
    expect(land.sea).toBeGreaterThan(0.8);
    expect(land.relief).toBeLessThan(1);
  });

  it('is the place itself once the journey is done', () => {
    const s = startJourney(ROUTE, T0);
    const done = advance(ROUTE, s, T0 + 100 * H).state;
    expect(landAt(ROUTE, locate(ROUTE, done, T0 + 100 * H))).toEqual({ relief: 0.55, sea: 1 });
  });
});
