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
    expect(pos.kmIntoLeg).toBeCloseTo(KM_PER_HOUR, 6);
    expect(pos.fraction).toBeCloseTo(KM_PER_HOUR / 8, 6);
  });

  it('arrives at the exact moment and then rests', () => {
    const s = startJourney(ROUTE, T0);
    const legHours = 8 / KM_PER_HOUR;
    const { state, arrived } = advance(ROUTE, s, T0 + (legHours + 1) * H);
    expect(arrived.map((p) => p.id)).toEqual(['b']);
    expect(state.arrivals[1]).toEqual({ placeId: 'b', at: T0 + legHours * H });
    expect(state.km).toBe(8);
    expect(state.restingUntil).toBe(T0 + legHours * H + REST_MS);
    const pos = locate(ROUTE, state, T0 + (legHours + 1) * H);
    expect(pos.resting).toBe(true);
    expect(pos.from.id).toBe('b');
    expect(describeJourney(pos)).toBe('Resting in Bravo');
  });

  it('carries on from the saved kilometre when the pace changes (D10 migration)', () => {
    // A journey saved by an older build that walked 6 km/h and rested 3 h:
    // mid-leg, 5.5 km along, last checkpoint an hour after setting out.
    const saved = { ...startJourney(ROUTE, T0), km: 5.5, updatedAt: T0 + 1 * H };
    const later = advance(ROUTE, saved, T0 + 2 * H);
    // No rewind, no skipped place: just one more hour at today's pace.
    expect(later.state.km).toBeCloseTo(5.5 + KM_PER_HOUR, 6);
    expect(later.arrived).toEqual([]);
    expect(later.state.arrivals).toHaveLength(1);
    // A rest saved under the old 3 h rule is honoured as saved, then walking resumes.
    const oldRest = T0 + 10 * H + 3 * H;
    const resting = { ...saved, km: 8, arrivals: [...saved.arrivals, { placeId: 'b', at: T0 + 10 * H }], restingUntil: oldRest, updatedAt: T0 + 11 * H };
    expect(locate(ROUTE, resting, T0 + 12 * H).resting).toBe(true);
    const walking = advance(ROUTE, resting, oldRest + 1 * H);
    expect(walking.state.km).toBeCloseTo(8 + KM_PER_HOUR, 6);
    expect(walking.state.restingUntil).toBeNull();
  });

  it('sets off again after the rest and reaches the end', () => {
    const s = startJourney(ROUTE, T0);
    const restH = REST_MS / H;
    const leg1 = 8 / KM_PER_HOUR;
    const leg2 = 12 / KM_PER_HOUR;
    const arriveC = T0 + (leg1 + restH + leg2) * H;
    const early = advance(ROUTE, s, arriveC - 0.5 * H);
    expect(early.arrived.map((p) => p.id)).toEqual(['b']);
    expect(locate(ROUTE, early.state, arriveC - 0.5 * H).kmToNext).toBeCloseTo(0.5 * KM_PER_HOUR, 6);
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
    expect(b.at - a.at).toBeCloseTo((8 / KM_PER_HOUR) * H, 3);
    expect(c.at - b.at).toBeCloseTo(REST_MS + (12 / KM_PER_HOUR) * H, 3);
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
    const halfHour = T0 + 0.5 * H;
    const pos = locate(ROUTE, advance(ROUTE, s, halfHour).state, halfHour);
    expect(describeJourney(pos)).toBe(`Walking to Bravo · ${Math.round(8 - 0.5 * KM_PER_HOUR)} km to go`);
    const justBefore = T0 + ((8 - 0.5) / KM_PER_HOUR) * H;
    const near = locate(ROUTE, advance(ROUTE, s, justBefore).state, justBefore);
    expect(describeJourney(near)).toBe('Walking to Bravo · almost there');
  });
});

describe('addBonusKm', () => {
  it('pushes the wanderer ahead and collects the places crossed', () => {
    const s = startJourney(ROUTE, T0);
    const { state, arrived } = addBonusKm(ROUTE, s, 10, T0 + 0.25 * H);
    expect(arrived.map((p) => p.id)).toEqual(['b']);
    expect(state.km).toBeCloseTo(10 + 0.25 * KM_PER_HOUR, 6);
    expect(state.bonusKm).toBe(10);
  });
});

describe('landAt', () => {
  it('uses the leg terrain in the middle and blends near the ends', () => {
    const s = startJourney(ROUTE, T0);
    const midTime = T0 + (4 / KM_PER_HOUR) * H;
    const mid = locate(ROUTE, advance(ROUTE, s, midTime).state, midTime);
    expect(landAt(ROUTE, mid)).toEqual({ relief: 0.4, sea: 0 });
    // Leg 2 is hills (relief 1) leading to a coast (sea 1): near the end the sea shows.
    const restH = REST_MS / H;
    const nearEndTime = T0 + (8 / KM_PER_HOUR + restH + 11.6 / KM_PER_HOUR) * H;
    const nearEnd = advance(ROUTE, s, nearEndTime).state;
    const pos = locate(ROUTE, nearEnd, nearEndTime);
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
