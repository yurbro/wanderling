import { describe, expect, it } from 'vitest';
import { HOME_RETURN_ID, buildSegmentRoute, departureNote, homewardRoute, nextSegment } from '../src/core/chain';
import { FLY_KM_PER_HOUR, REST_MS, advance, describeJourney, locate, startJourney } from '../src/core/journey';
import { TO_THE_SEA, DOWN_THE_SEINE, TO_THE_HOT_SPRINGS } from '../src/data/routes';
import { routeFromHome } from '../src/core/geo';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 4, 8, 0, 0);
/** The chain tests reason about three routes; the bundle has grown since. */
const THREE = [TO_THE_SEA, TO_THE_HOT_SPRINGS, DOWN_THE_SEINE];
const BRIGHTON = { name: 'Brighton', region: 'United Kingdom', lat: 50.82, lon: -0.14 };

/** A year later: every segment is long done and the final rest is over. */
function finish(route: ReturnType<typeof routeFromHome>, journey: ReturnType<typeof startJourney>) {
  const t = journey.updatedAt + 365 * 24 * H;
  return { state: advance(route, journey, t).state, t };
}

describe('legs by train and plane', () => {
  it('covers a flight at flying speed and tells the HUD', () => {
    const route = routeFromHome(TO_THE_SEA, { name: 'Tokyo', lat: 35.68, lon: 139.69 });
    const s = startJourney(route, T0);
    const flightKm = route.legs[0].km;
    const midway = T0 + (flightKm / 2 / FLY_KM_PER_HOUR) * H;
    const pos = locate(route, advance(route, s, midway).state, midway);
    expect(pos.mode).toBe('fly');
    expect(pos.fraction).toBeCloseTo(0.5, 2);
    expect(describeJourney(pos)).toMatch(/^Flying to London · [\d,]+ km to go$/);
    const landed = advance(route, s, T0 + (flightKm / FLY_KM_PER_HOUR) * H + 60_000).state;
    expect(landed.arrivals.map((a) => a.placeId)).toEqual(['home', 'london']);
    expect(describeJourney(locate(route, landed, T0 + (flightKm / FLY_KM_PER_HOUR) * H + 60_000))).toBe('Resting in London');
  });

  it('says "On the train" for a ride', () => {
    const route = routeFromHome(TO_THE_SEA, { name: 'Berlin', lat: 52.52, lon: 13.4 });
    const s = startJourney(route, T0);
    const pos = locate(route, advance(route, s, T0 + 1 * H).state, T0 + 1 * H);
    expect(pos.mode).toBe('ride');
    expect(describeJourney(pos)).toMatch(/^On the train to London/);
  });
});

describe('nextSegment', () => {
  it('walks on to the nearest unwalked route from where the last one ended', () => {
    const route = routeFromHome(TO_THE_SEA, BRIGHTON);
    const journey = { ...startJourney(route, T0), home: BRIGHTON, walked: [] };
    const { state, t } = finish(route, journey);
    expect(locate(route, state, t).finished).toBe(true);
    const seg = nextSegment(state, route, THREE, t);
    expect(seg.route.id).toBe(DOWN_THE_SEINE.id);
    expect(seg.route.places[0].name).toBe('Seven Sisters');
    expect(seg.route.legs[0].mode).toBe('walk');
    expect(seg.journey.from?.name).toBe('Seven Sisters');
    expect(seg.journey.walked).toEqual([TO_THE_SEA.id]);
    expect(seg.journey.arrivals).toEqual([]);
    expect(seg.journey.home).toEqual(BRIGHTON);
  });

  it('flies to a far route, then heads home, then starts over', () => {
    // After the Seine: only Tokyo is left, a flight away.
    const seine = buildSegmentRoute({ ...startJourney(DOWN_THE_SEINE, T0), home: BRIGHTON, from: { name: 'Seven Sisters', lat: 50.75, lon: 0.15 }, walked: [TO_THE_SEA.id] }, THREE)!;
    expect(seine.places[0].id).toBe('from');
    const seineDone = finish(seine, { ...startJourney(seine, T0, { arrived: false }), home: BRIGHTON, from: { name: 'Seven Sisters', lat: 50.75, lon: 0.15 }, walked: [TO_THE_SEA.id] });
    const toTokyo = nextSegment(seineDone.state, seine, THREE, seineDone.t);
    expect(toTokyo.route.id).toBe(TO_THE_HOT_SPRINGS.id);
    expect(toTokyo.route.legs[0].mode).toBe('fly');
    expect(toTokyo.journey.walked).toEqual([TO_THE_SEA.id, DOWN_THE_SEINE.id]);
    expect(departureNote(toTokyo.route.legs[0].mode!, toTokyo.route.places[1].name)).toBe('Off again, flying to Tokyo.');

    // After Tokyo: everything walked, so homeward.
    const tokyoDone = finish(toTokyo.route, toTokyo.journey);
    const homeward = nextSegment(tokyoDone.state, toTokyo.route, THREE, tokyoDone.t);
    expect(homeward.route.id).toBe(HOME_RETURN_ID);
    expect(homeward.route.places[1].name).toBe('Brighton');
    expect(homeward.route.legs[0].mode).toBe('fly');
    expect(buildSegmentRoute(homeward.journey, THREE)?.id).toBe(HOME_RETURN_ID);

    // Home, rested: the chain begins again from Brighton on the nearest route.
    const homeDone = finish(homeward.route, homeward.journey);
    expect(homeDone.state.arrivals.map((a) => a.placeId)).toEqual(['home']);
    const again = nextSegment(homeDone.state, homeward.route, THREE, homeDone.t);
    expect(again.route.id).toBe(TO_THE_SEA.id);
    expect(again.route.places[0].id).toBe('home');
    expect(again.journey.walked).toEqual([]);
    expect(again.journey.from).toBeNull();
  });

  it('starts over from the last place when no home is known', () => {
    const { state, t } = finish(TO_THE_SEA, startJourney(TO_THE_SEA, T0));
    const seg = nextSegment(state, TO_THE_SEA, THREE, t);
    expect(seg.route.id).toBe(DOWN_THE_SEINE.id);
    const seineDone = finish(seg.route, seg.journey);
    const seg2 = nextSegment(seineDone.state, seg.route, THREE, seineDone.t);
    expect(seg2.route.id).toBe(TO_THE_HOT_SPRINGS.id);
    const tokyoDone = finish(seg2.route, seg2.journey);
    const seg3 = nextSegment(tokyoDone.state, seg2.route, THREE, tokyoDone.t);
    expect(seg3.route.id).not.toBe(TO_THE_HOT_SPRINGS.id);
    expect(seg3.journey.walked).toEqual([]);
  });

  it('skips the homeward leg when home is where the route ends', () => {
    expect(homewardRoute({ name: 'A', lat: 50.75, lon: 0.15 }, { name: 'B', lat: 50.751, lon: 0.151 })).toBeNull();
    expect(buildSegmentRoute({ ...startJourney(TO_THE_SEA, T0), routeId: 'nope' }, THREE)).toBeNull();
  });

  it('rests at the end before the next segment is due', () => {
    const route = routeFromHome(TO_THE_SEA, BRIGHTON);
    const { state } = finish(route, { ...startJourney(route, T0), home: BRIGHTON });
    const last = state.arrivals[state.arrivals.length - 1];
    expect(state.restingUntil).toBe(last.at + REST_MS);
  });
});
