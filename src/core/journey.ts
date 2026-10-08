import { formatKm, placeName, t } from './i18n';
import type { Arrival, JourneyState, Leg, LegMode, Place, Position, Route, Terrain } from './types';

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

/**
 * Walking pace. The design (decisions.md, D10) wants a new place every 2 to
 * 3 days, with real distances on the map: so the wanderling simply walks
 * slowly and rests half a day at each place. Since review 3 it also really
 * sleeps from 2:00 to 4:00 by the person's clock and does not walk then, so
 * the pace is 24/22 of the old 0.9 km/h to keep the same rhythm: over the
 * seven routes' legs (about 44 km on average) still 2.5 days a stop.
 *
 * Changing these is safe for a journey already under way: the engine
 * checkpoints `km` and `updatedAt` on every tick and only ever walks on from
 * there, so a new pace never rewinds or skips a place (see the journey tests).
 */
export const KM_PER_HOUR = 0.98;
/** How long the wanderling lingers at each place before walking on. */
export const REST_MS = 12 * 60 * 60_000;
/** Between routes the wanderer may take a train, or a plane across the sea. */
export const RIDE_KM_PER_HOUR = 60;
export const FLY_KM_PER_HOUR = 700;

const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------------ */
/* Sleep: no walking from 2:00 to 4:00 by the person's own clock             */
/* ------------------------------------------------------------------------ */

export const SLEEP_FROM_HOUR = 2;
export const SLEEP_UNTIL_HOUR = 4;

/**
 * When the wanderling is asleep: given a moment, the first sleep window that
 * has not ended yet, as [start, end) in epoch ms (start may be in the past).
 */
export type SleepClock = (t: number) => [number, number];

/**
 * The person's own nights, from the device's time zone (the same clock the
 * scene uses to draw him asleep). A night that loses or gains an hour to
 * daylight saving simply has a shorter or longer sleep.
 */
export const localNights: SleepClock = (t) => {
  const d = new Date(t);
  for (let add = 0; add < 3; add++) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, SLEEP_FROM_HOUR).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, SLEEP_UNTIL_HOUR).getTime();
    if (end > t) return [start, end];
  }
  return [Infinity, Infinity];
};

/** Nights at a fixed offset from UTC, in minutes (tests, and anywhere the device clock will not do). */
export function nightsAt(offsetMinutes: number): SleepClock {
  const DAY = 24 * HOUR_MS;
  const off = offsetMinutes * 60_000;
  return (t) => {
    const dayStart = Math.floor((t + off) / DAY) * DAY - off;
    for (let add = 0; add < 3; add++) {
      const start = dayStart + add * DAY + SLEEP_FROM_HOUR * HOUR_MS;
      const end = dayStart + add * DAY + SLEEP_UNTIL_HOUR * HOUR_MS;
      if (end > t) return [start, end];
    }
    return [Infinity, Infinity];
  };
}

/** A wanderling that never sleeps: for checking the pace arithmetic on its own. */
export const NEVER_ASLEEP: SleepClock = () => [Infinity, Infinity];

/** Milliseconds awake between `a` and `b`. */
export function awakeMs(a: number, b: number, sleep: SleepClock = localNights): number {
  let total = 0;
  let t = a;
  // One turn per night in the span; a year away is a few hundred turns.
  for (let guard = 0; guard < 4000 && t < b; guard++) {
    const [start, end] = sleep(t);
    if (start >= b) return total + (b - t);
    if (start > t) total += start - t;
    t = Math.max(t, end);
  }
  return total;
}

/** The moment `ms` of awake time has passed since `a`. */
export function afterAwake(a: number, ms: number, sleep: SleepClock = localNights): number {
  let t = a;
  let left = ms;
  for (let guard = 0; guard < 4000; guard++) {
    if (left <= 0) return t;
    const [start, end] = sleep(t);
    if (start > t) {
      if (left <= start - t) return t + left;
      left -= start - t;
    }
    t = Math.max(t, end);
  }
  return t + left;
}

export function legSpeed(leg: Leg | undefined): number {
  switch (leg?.mode) {
    case 'ride':
      return RIDE_KM_PER_HOUR;
    case 'fly':
      return FLY_KM_PER_HOUR;
    default:
      return KM_PER_HOUR;
  }
}

/** Journey km at which each place sits, starting at 0. */
export function placeKms(route: Route): number[] {
  const out = [0];
  for (const leg of route.legs) out.push(out[out.length - 1] + leg.km);
  return out;
}

export function totalKm(route: Route): number {
  return route.legs.reduce((sum, leg) => sum + leg.km, 0);
}

/**
 * A fresh journey: standing at the first place, about to leave. The first
 * place counts as reached unless `arrived` is false (a chained segment that
 * starts where the last one ended, already on the album).
 */
export function startJourney(route: Route, now: number, opts: { arrived?: boolean } = {}): JourneyState {
  return {
    routeId: route.id,
    startedAt: now,
    km: 0,
    updatedAt: now,
    restingUntil: null,
    arrivals: opts.arrived === false ? [] : [{ placeId: route.places[0].id, at: now }],
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
 * even if the clock does. On foot nothing happens while the wanderling
 * sleeps (`sleep`, the person's nights by default); a train or a plane
 * carries a sleeping passenger on regardless.
 */
export function advance(route: Route, state: JourneyState, now: number, sleep: SleepClock = localNights): AdvanceResult {
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
    // The leg we are on sets the speed: feet, train or plane.
    const leg = route.legs[Math.max(0, nextIndex - 1)];
    const speed = legSpeed(leg);
    const onFoot = (leg?.mode ?? 'walk') === 'walk';
    const kmAvailable = ((onFoot ? awakeMs(t, now, sleep) : now - t) / HOUR_MS) * speed;
    const kmNeeded = nextKm - km;
    if (kmAvailable < kmNeeded) {
      km += kmAvailable;
      t = now;
      break;
    }
    const needMs = (kmNeeded / speed) * HOUR_MS;
    const arriveAt = onFoot ? afterAwake(t, needMs, sleep) : t + needMs;
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
export function addBonusKm(route: Route, state: JourneyState, km: number, now: number, sleep: SleepClock = localNights): AdvanceResult {
  const first = advance(route, state, now, sleep);
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
      mode: 'walk',
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
    mode: route.legs[legIndex].mode ?? 'walk',
    km,
    totalKm: total,
  };
}

const VERB: Record<LegMode, 'walkingTo' | 'ridingTo' | 'flyingTo'> = { walk: 'walkingTo', ride: 'ridingTo', fly: 'flyingTo' };
const NEAR_KM: Record<LegMode, number> = { walk: 1, ride: 10, fly: 50 };

/**
 * How far into the "almost there" stretch, 0..1: 0 while the HUD still counts
 * kilometres, rising from the moment it says "almost there" to 1 on arrival.
 * The scene grows the destination's far silhouette by the same number, so
 * the picture and the words agree (review 3, ruling 4).
 */
export function approach(pos: Position): number {
  if (pos.finished || pos.resting || pos.to === null) return 0;
  const near = NEAR_KM[pos.mode];
  if (pos.kmToNext >= near) return 0;
  return Math.min(1, Math.max(0, 1 - pos.kmToNext / near));
}

/** True while the HUD says "almost there". */
export function almostThere(pos: Position): boolean {
  return !pos.finished && !pos.resting && pos.to !== null && pos.kmToNext < NEAR_KM[pos.mode];
}

/** The HUD line, e.g. "Walking to Brighton · 31 km to go". */
export function describeJourney(pos: Position): string {
  if (pos.finished) return t('journeysEnd', { name: placeName(pos.from) });
  if (pos.resting) return t('restingIn', { name: placeName(pos.from) });
  const left = almostThere(pos) ? t('almostThere') : t('kmToGo', { km: formatKm(pos.kmToNext) });
  return `${t(VERB[pos.mode], { name: placeName(pos.to!) })} · ${left}`;
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
