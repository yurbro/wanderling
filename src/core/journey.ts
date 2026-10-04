import type { Arrival, JourneyState, Place, Position, Route, Terrain } from './types';

/**
 * The journey engine, pure and clock-driven.
 *
 * The wanderer always walks, app open or not, at a fixed pace. Reaching a
 * place means a rest there before setting off again, so "I'm in Brighton"
 * is a state that lasts for hours, not an instant. All of it is derived from
 * timestamps, so closing the app for a week simply replays the week.
 *
 * Distances are real kilometres; the pace is the one knob that sets how
 * often something new happens.
 */

/** Walking pace: a brisk walker who never stops, day or night. */
export const KM_PER_HOUR = 4;
/** How long the wanderer lingers at each place before walking on. */
export const REST_MS = 6 * 60 * 60_000;

const HOUR_MS = 3_600_000;

/** Journey km at which each place sits, starting at 0. */
export function placeKms(route: Route): number[] {
  const out = [0];
  for (const leg of route.legs) out.push(out[out.length - 1] + leg.km);
  return out;
}

export function totalKm(route: Route): number {
  return route.legs.reduce((sum, leg) => sum + leg.km, 0);
}

/** A fresh journey: standing at the first place, about to leave. */
export function startJourney(route: Route, now: number): JourneyState {
  return {
    routeId: route.id,
    startedAt: now,
    km: 0,
    updatedAt: now,
    restingUntil: null,
    arrivals: [{ placeId: route.places[0].id, at: now }],
    bonusKm: 0,
  };
}

export interface AdvanceResult {
  state: JourneyState;
  /** Places reached during this advance, in order. */
  arrived: Place[];
}

/**
 * Move the journey forward to `now`. Walks leg by leg, pausing REST_MS at
 * every place, and stops at the end of the route. Never moves backwards,
 * even if the clock does.
 */
export function advance(route: Route, state: JourneyState, now: number): AdvanceResult {
  const kms = placeKms(route);
  const end = kms[kms.length - 1];
  if (now <= state.updatedAt) return { state: { ...state }, arrived: [] };
  let t = state.updatedAt;
  let km = state.km;
  let restingUntil = state.restingUntil;
  const arrivals = [...state.arrivals];
  const arrived: Place[] = [];

  // Up to one iteration per place, plus one; the loop always makes progress.
  for (let guard = 0; guard < route.places.length + 2; guard++) {
    if (km >= end) break;
    if (restingUntil !== null) {
      if (now < restingUntil) break;
      t = Math.max(t, restingUntil);
      restingUntil = null;
    }
    const nextIndex = kms.findIndex((k) => k > km + 1e-9);
    const nextKm = nextIndex === -1 ? end : kms[nextIndex];
    const kmAvailable = ((now - t) / HOUR_MS) * KM_PER_HOUR;
    const kmNeeded = nextKm - km;
    if (kmAvailable < kmNeeded) {
      km += kmAvailable;
      t = now;
      break;
    }
    const arriveAt = t + (kmNeeded / KM_PER_HOUR) * HOUR_MS;
    km = nextKm;
    t = arriveAt;
    const place = route.places[nextIndex];
    arrivals.push({ placeId: place.id, at: arriveAt });
    arrived.push(place);
    restingUntil = arriveAt + REST_MS;
  }

  return {
    state: { ...state, km: Math.min(km, end), updatedAt: now, restingUntil, arrivals },
    arrived,
  };
}

/**
 * Real-world activity pushes the wanderer ahead; it never slows them down.
 * Places crossed by the push count as reached now, and any rest is cut short.
 */
export function addBonusKm(route: Route, state: JourneyState, km: number, now: number): AdvanceResult {
  const first = advance(route, state, now);
  const bonus = Math.max(0, km);
  if (bonus === 0) return first;
  const kms = placeKms(route);
  const end = kms[kms.length - 1];
  const before = first.state.km;
  const after = Math.min(end, before + bonus);
  const arrivals = [...first.state.arrivals];
  const arrived = [...first.arrived];
  for (let i = 0; i < route.places.length; i++) {
    if (kms[i] > before + 1e-9 && kms[i] <= after + 1e-9) {
      arrivals.push({ placeId: route.places[i].id, at: now });
      arrived.push(route.places[i]);
    }
  }
  return {
    state: { ...first.state, km: after, bonusKm: first.state.bonusKm + bonus, restingUntil: null, arrivals },
    arrived,
  };
}

/** Where on the route the wanderer stands for a given state. */
export function locate(route: Route, state: JourneyState, now: number): Position {
  const kms = placeKms(route);
  const end = kms[kms.length - 1];
  const km = Math.min(state.km, end);
  const total = end;
  const finished = km >= end - 1e-9;
  if (finished) {
    const last = route.places[route.places.length - 1];
    return {
      route,
      from: last,
      to: null,
      legIndex: Math.max(0, route.legs.length - 1),
      kmIntoLeg: route.legs.length ? route.legs[route.legs.length - 1].km : 0,
      kmToNext: 0,
      fraction: 1,
      resting: false,
      finished: true,
      km,
      totalKm: total,
    };
  }
  // The leg we are on: the last place at or before km.
  let legIndex = 0;
  for (let i = 0; i < route.legs.length; i++) {
    if (kms[i] <= km + 1e-9) legIndex = i;
  }
  const legKm = route.legs[legIndex].km;
  const kmIntoLeg = km - kms[legIndex];
  const resting = state.restingUntil !== null && now < state.restingUntil && kmIntoLeg < 1e-9;
  return {
    route,
    from: route.places[legIndex],
    to: route.places[legIndex + 1],
    legIndex,
    kmIntoLeg,
    kmToNext: legKm - kmIntoLeg,
    fraction: legKm > 0 ? kmIntoLeg / legKm : 1,
    resting,
    finished: false,
    km,
    totalKm: total,
  };
}

/** The HUD line, in English, e.g. "Walking to Brighton · 31 km to go". */
export function describeJourney(pos: Position): string {
  if (pos.finished) return `Journey's end: ${pos.from.name}`;
  if (pos.resting) return `Resting in ${pos.from.name}`;
  const left = pos.kmToNext < 1 ? 'almost there' : `${Math.round(pos.kmToNext)} km to go`;
  return `Walking to ${pos.to!.name} · ${left}`;
}

/** The last arrival, handy for "arrived while you were away" notes. */
export function lastArrival(state: JourneyState): Arrival | null {
  return state.arrivals.length ? state.arrivals[state.arrivals.length - 1] : null;
}

/* ------------------------------------------------------------------------ */
/* Terrain to land shape                                                     */
/* ------------------------------------------------------------------------ */

interface TerrainProfile {
  /** Multiplier on hill height. */
  relief: number;
  /** 0..1 how much of the far layer is water. */
  sea: number;
}

export const TERRAIN: Record<Terrain, TerrainProfile> = {
  city: { relief: 0.7, sea: 0 },
  plain: { relief: 0.4, sea: 0 },
  hills: { relief: 1, sea: 0 },
  mountain: { relief: 1.6, sea: 0 },
  forest: { relief: 0.85, sea: 0 },
  coast: { relief: 0.55, sea: 1 },
  lake: { relief: 0.7, sea: 0.7 },
  desert: { relief: 0.45, sea: 0 },
};

/**
 * The land where the wanderer is: the leg's own terrain, blended towards the
 * destination's as they get close so the scenery changes gradually.
 */
export function landAt(route: Route, pos: Position): TerrainProfile {
  if (pos.finished || pos.to === null) return TERRAIN[pos.from.terrain];
  const leg = TERRAIN[route.legs[pos.legIndex].terrain];
  const from = TERRAIN[pos.from.terrain];
  const to = TERRAIN[pos.to.terrain];
  // First tenth of the leg: leaving `from`; last fifth: approaching `to`.
  const f = pos.fraction;
  let base = leg;
  let other = leg;
  let k = 0;
  if (f < 0.1) {
    other = from;
    k = 1 - f / 0.1;
  } else if (f > 0.8) {
    other = to;
    k = (f - 0.8) / 0.2;
  }
  const lerp = (a: number, b: number): number => a + (b - a) * k;
  base = { relief: lerp(leg.relief, other.relief), sea: lerp(leg.sea, other.sea) };
  return base;
}
