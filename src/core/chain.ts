import { nearestRoute, transferMode, withTransfer } from './geo';
import { startJourney } from './journey';
import { withOutset } from './outset';
import type { Home, JourneyState, LegMode, Place, Route } from './types';
import { haversineKm } from './geo';
import { t } from './i18n';

/**
 * The chain: what happens when a route is finished. The wanderer sets off
 * for the nearest route not yet walked since leaving home, on foot if it is
 * close, by train or plane if not. When every route has been walked, they
 * head home; after a rest at home the chain begins again.
 */

export const HOME_RETURN_ID = 'home-return-v1';

export interface Segment {
  route: Route;
  journey: JourneyState;
}

function asHome(p: Place): Home | null {
  if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
  return { name: p.name, region: p.region, lat: p.lat, lon: p.lon };
}

function leavingNote(name: string): string {
  return t('leftWithSand', { name });
}

/** The short route that brings the wanderer home from where the last route ended. */
export function homewardRoute(from: Home, home: Home): Route | null {
  const km = haversineKm(from, home);
  if (km < 3) return null;
  return {
    id: HOME_RETURN_ID,
    name: t('homeward'),
    places: [
      { id: 'from', name: from.name, region: from.region, terrain: 'city', lat: from.lat, lon: from.lon, note: leavingNote(from.name) },
      { id: 'home', name: home.name, region: home.region, terrain: 'city', lat: home.lat, lon: home.lon, note: t('homeAgain') },
    ],
    legs: [{ km: Math.round(km), terrain: 'plain', mode: transferMode(km) }],
  };
}

/**
 * Rebuild the route a saved journey is on. Null when the saved route id is
 * unknown (the caller then starts afresh).
 */
export function buildSegmentRoute(state: JourneyState, routes: Route[]): Route | null {
  if (state.routeId === HOME_RETURN_ID) {
    return state.from && state.home ? homewardRoute(state.from, state.home) : null;
  }
  const base = routes.find((r) => r.id === state.routeId);
  if (!base) return null;
  if (state.outset) return withOutset(base, state.outset);
  if (state.from) return withTransfer(base, state.from, 'from', leavingNote(state.from.name));
  return withTransfer(base, state.home, 'home');
}

/** What the HUD says as the wanderer sets off on a new segment. */
export function departureNote(mode: LegMode, to: string): string {
  switch (mode) {
    case 'ride':
      return t('offByTrain', { name: to });
    case 'fly':
      return t('offFlying', { name: to });
    default:
      return t('offOnFoot', { name: to });
  }
}

/** What the map offers as the next route: how far and how one would get there. */
export interface RouteOption {
  route: Route;
  /** Walked since leaving home, or the one being walked now. */
  walked: boolean;
  current: boolean;
  chosen: boolean;
  km: number;
  mode: LegMode;
}

/** The place the next segment would set off from: where the current route ends. */
export function segmentEnd(route: Route): Home | null {
  const last = route.places[route.places.length - 1];
  return last ? asHome(last) : null;
}

/** Every route, for the picker on the map, measured from the end of the current one. */
export function routeOptions(state: JourneyState, route: Route, routes: Route[]): RouteOption[] {
  const end = segmentEnd(route);
  const walked = state.walked ?? [];
  return routes.map((r) => {
    const first = r.places[0];
    const km = end && first && typeof first.lat === 'number' && typeof first.lon === 'number' ? haversineKm(end, { lat: first.lat, lon: first.lon }) : 0;
    return { route: r, walked: walked.includes(r.id), current: r.id === state.routeId, chosen: state.next === r.id, km: Math.round(km), mode: transferMode(km) };
  });
}

/** Remember (or clear, with null) the route to set off for next. The current route cannot be picked. */
export function chooseNext(state: JourneyState, routeId: string | null): JourneyState {
  if (routeId === state.routeId) return { ...state, next: null };
  return { ...state, next: routeId };
}

/**
 * The next segment once the current route is done and the rest is over.
 * Order of preference: the route picked on the map, if any;
 * then the nearest route not yet walked in this chain;
 * then home, if known and not already here; then the chain starts over.
 */
export function nextSegment(state: JourneyState, route: Route, routes: Route[], now: number): Segment {
  const last = route.places[route.places.length - 1];
  const from = asHome(last);
  const home = state.home ?? null;
  const cameHome = state.routeId === HOME_RETURN_ID;
  const walked = cameHome ? [] : [...(state.walked ?? []), ...(routes.some((r) => r.id === state.routeId) ? [state.routeId] : [])];

  const begin = (base: Route, start: Home | null, startId: 'home' | 'from', walkedIds: string[]): Segment => {
    const next = withTransfer(base, start, startId, startId === 'from' && start ? leavingNote(start.name) : undefined);
    const journey: JourneyState = {
      ...startJourney(next, now, { arrived: false }),
      home,
      from: startId === 'from' ? start : null,
      walked: walkedIds,
      next: null,
    };
    return { route: next, journey };
  };

  const picked = state.next ? routes.find((r) => r.id === state.next && r.id !== state.routeId) : undefined;
  if (picked) {
    const start = from ?? home;
    return begin(picked, start, from ? 'from' : 'home', cameHome ? [] : walked);
  }

  if (cameHome && home) {
    // Rested at home: the whole chain begins again from the front door.
    return begin(nearestRoute(routes, home).route, home, 'home', []);
  }

  const candidates = routes.filter((r) => !walked.includes(r.id));
  if (candidates.length > 0 && from) {
    return begin(nearestRoute(candidates, from).route, from, 'from', walked);
  }

  if (home && from) {
    const homeward = homewardRoute(from, home);
    if (homeward) {
      const journey: JourneyState = { ...startJourney(homeward, now, { arrived: false }), home, from, walked, next: null };
      return { route: homeward, journey };
    }
  }

  // No home known, or already standing at it: start the chain over from here,
  // avoiding the route just finished when there is a choice.
  const others = routes.filter((r) => r.id !== state.routeId);
  const pool = others.length > 0 ? others : routes;
  return begin(nearestRoute(pool, from ?? home ?? { lat: 0, lon: 0 }).route, from, 'from', []);
}
