import { describe, expect, it } from 'vitest';
import { buildSegmentRoute, departureNote, nextSegment, routeOptions } from '../src/core/chain';
import { endingSeason } from '../src/core/ending';
import { haversineKm, routeFromHome } from '../src/core/geo';
import {
  FERRY_KM_PER_HOUR,
  REST_MS,
  SHIP_KM_PER_HOUR,
  advance,
  advanceAlong,
  describeJourney,
  inSeason,
  legSpeed,
  locate,
  nightsAt,
  outOfSeason,
  placeKms,
  restMs,
  seasonalSkips,
  startJourney,
  totalKm,
  withoutPlaces,
} from '../src/core/journey';
import { setLang } from '../src/core/i18n';
import { outsetDestination } from '../src/core/outset';
import type { JourneyState } from '../src/core/types';
import { isJourneyState } from '../src/data/journeyStore';
import { NORTH_LIGHT, ROUTES, SHORT_ROUTES, TO_THE_SEA, routeById } from '../src/data/routes';

const H = 3_600_000;
const DAY = 24 * H;
const utc = nightsAt(0);
const BRIGHTON = { name: 'Brighton', region: 'United Kingdom', lat: 50.82, lon: -0.14 };

/** The route as travelled for a state, as main.ts rebuilds it. */
const routeFor = (s: JourneyState) => buildSegmentRoute(s, ROUTES)!;

/** Walk the whole line from Lisbon, starting at `start`, and come back with the finished state and the route as travelled. */
function walkAll(start: number) {
  const journey: JourneyState = { ...startJourney(NORTH_LIGHT, start), home: null, from: null, walked: [] };
  const done = advanceAlong(routeFor, journey, start + 200 * DAY, utc);
  return { ...done, start };
}

describe('the North Light data (section 9, rulings 23 to 25)', () => {
  it('has 43 places from Lisbon to Tromsø, all named in both languages, with coordinates', () => {
    expect(NORTH_LIGHT.id).toBe('north-light-v1');
    expect(NORTH_LIGHT.long).toBe(true);
    expect(NORTH_LIGHT.places).toHaveLength(43);
    expect(NORTH_LIGHT.legs).toHaveLength(42);
    expect(NORTH_LIGHT.places[0].id).toBe('lisbon');
    expect(NORTH_LIGHT.places[42].id).toBe('tromso');
    expect(new Set(NORTH_LIGHT.places.map((p) => p.id)).size).toBe(43);
    for (const p of NORTH_LIGHT.places) {
      expect(p.zh?.name, p.id).toBeTruthy();
      expect(p.zh?.note, p.id).toBeTruthy();
      expect(p.zh?.region, p.id).toMatch(/^[一-鿿]+$/);
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
    }
    expect(routeById('north-light-v1')).toBe(NORTH_LIGHT);
    expect(ROUTES).toContain(NORTH_LIGHT);
    expect(SHORT_ROUTES).not.toContain(NORTH_LIGHT);
  });

  it('is about 7800 km, by foot, train, ferry and coastal ship, with the sea outside the boats', () => {
    expect(totalKm(NORTH_LIGHT)).toBeGreaterThan(7700);
    expect(totalKm(NORTH_LIGHT)).toBeLessThan(7900);
    const modes = NORTH_LIGHT.legs.map((l) => l.mode);
    expect(modes.filter((m) => m === 'walk')).toHaveLength(22);
    expect(modes.filter((m) => m === 'ride')).toHaveLength(12);
    expect(modes.filter((m) => m === 'ferry')).toHaveLength(1);
    expect(modes.filter((m) => m === 'ship')).toHaveLength(7);
    for (const leg of NORTH_LIGHT.legs) if (leg.mode === 'ferry' || leg.mode === 'ship') expect(leg.terrain).toBe('coast');
    // The ferry is the night boat to Oslo; the first ship leaves Bergen for Ålesund.
    expect(NORTH_LIGHT.places[32].id).toBe('oslo');
    expect(NORTH_LIGHT.legs[31].mode).toBe('ferry');
    expect(NORTH_LIGHT.places[36].id).toBe('alesund');
    expect(NORTH_LIGHT.legs[35].mode).toBe('ship');
  });

  it('rests a day and a half in Norway and half a day before it', () => {
    for (const p of NORTH_LIGHT.places) {
      expect(restMs(p), p.id).toBe(p.region === 'Norway' ? 1.5 * DAY : REST_MS);
    }
    expect(restMs(TO_THE_SEA.places[0])).toBe(REST_MS);
    expect(restMs(undefined)).toBe(REST_MS);
  });

  it('keeps the coordinates within a sensible distance of each stop before it', () => {
    // No leg is shorter than the crow flies, and none is wildly longer (a fjord ship winds).
    for (let i = 0; i < NORTH_LIGHT.legs.length; i++) {
      const a = NORTH_LIGHT.places[i];
      const b = NORTH_LIGHT.places[i + 1];
      const direct = haversineKm({ lat: a.lat!, lon: a.lon! }, { lat: b.lat!, lon: b.lon! });
      expect(NORTH_LIGHT.legs[i].km, `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(direct * 0.9);
      expect(NORTH_LIGHT.legs[i].km, `${a.id} to ${b.id}`).toBeLessThanOrEqual(direct * 2.6 + 15);
    }
  });
});

describe('ferry and coastal ship', () => {
  it('have their speeds and their lines in the HUD', () => {
    expect(legSpeed({ km: 100, terrain: 'coast', mode: 'ferry' })).toBe(FERRY_KM_PER_HOUR);
    expect(legSpeed({ km: 100, terrain: 'coast', mode: 'ship' })).toBe(SHIP_KM_PER_HOUR);
    const kms = placeKms(NORTH_LIGHT);
    const T0 = new Date(2026, 5, 1, 9, 0).getTime();
    const start = startJourney(NORTH_LIGHT, T0);
    // Midway across to Oslo, and midway up to Ålesund.
    const onFerry = { ...start, km: kms[31] + 100, restingUntil: null };
    const ferry = locate(NORTH_LIGHT, onFerry, T0);
    expect(ferry.mode).toBe('ferry');
    setLang('en');
    expect(describeJourney(ferry)).toMatch(/^On the ferry to Oslo · [\d,]+ km to go$/);
    const ship = locate(NORTH_LIGHT, { ...start, km: kms[35] + 100, restingUntil: null }, T0);
    expect(ship.mode).toBe('ship');
    expect(describeJourney(ship)).toMatch(/^On the coastal ship to Ålesund/);
    setLang('zh');
    expect(describeJourney(ferry)).toMatch(/^坐渡轮去奥斯陆/);
    expect(describeJourney(ship)).toMatch(/^坐海岸快船去奥勒松/);
    expect(departureNote('ferry', '奥斯陆')).toBe('又出发了，坐渡轮去奥斯陆。');
    expect(departureNote('ship', '奥勒松')).toBe('又出发了，坐海岸快船去奥勒松。');
    setLang('en');
    // Boats sail through the night: the ferry covers its distance in clock hours, asleep or not.
    const night = new Date(2026, 5, 1, 1, 0).getTime();
    const sailed = advance(NORTH_LIGHT, { ...onFerry, updatedAt: night }, night + 2 * H, nightsAt(0)).state;
    expect(sailed.km - onFerry.km).toBeCloseTo(2 * FERRY_KM_PER_HOUR, 6);
  });
});

describe('Geiranger in season (ruling 25)', () => {
  const alesund = NORTH_LIGHT.places.findIndex((p) => p.id === 'alesund');
  it('is passed from April to September and left out otherwise', () => {
    const geiranger = NORTH_LIGHT.places[alesund + 1];
    expect(geiranger.id).toBe('geiranger');
    expect(inSeason(geiranger, new Date(2026, 3, 1).getTime())).toBe(true);
    expect(inSeason(geiranger, new Date(2026, 8, 30).getTime())).toBe(true);
    expect(inSeason(geiranger, new Date(2026, 9, 1).getTime())).toBe(false);
    expect(inSeason(geiranger, new Date(2026, 2, 31).getTime())).toBe(false);
    expect(outOfSeason(NORTH_LIGHT, alesund, new Date(2026, 9, 15).getTime())).toEqual(['geiranger']);
    expect(outOfSeason(NORTH_LIGHT, alesund, new Date(2026, 6, 15).getTime())).toEqual([]);
    expect(outOfSeason(NORTH_LIGHT, alesund - 1, new Date(2026, 9, 15).getTime())).toEqual([]);
    expect(seasonalSkips(NORTH_LIGHT, new Date(2026, 10, 1).getTime())).toEqual(['geiranger']);
    expect(seasonalSkips(NORTH_LIGHT, new Date(2026, 5, 1).getTime())).toEqual([]);
  });

  it('takes the ship straight from Ålesund to Trondheim when it is left out', () => {
    const skipped = withoutPlaces(NORTH_LIGHT, ['geiranger']);
    expect(skipped.places).toHaveLength(42);
    expect(skipped.legs).toHaveLength(41);
    expect(skipped.places[alesund + 1].id).toBe('trondheim');
    const leg = skipped.legs[alesund];
    expect(leg.mode).toBe('ship');
    expect(leg.terrain).toBe('coast');
    const direct = haversineKm({ lat: 62.47, lon: 6.15 }, { lat: 63.43, lon: 10.4 });
    expect(leg.km).toBe(Math.round(direct * 1.2));
    // Kilometres before Ålesund do not move.
    expect(placeKms(skipped).slice(0, alesund + 1)).toEqual(placeKms(NORTH_LIGHT).slice(0, alesund + 1));
    expect(withoutPlaces(NORTH_LIGHT, [])).toBe(NORTH_LIGHT);
    expect(withoutPlaces(NORTH_LIGHT, undefined)).toBe(NORTH_LIGHT);
  });

  it('is decided on reaching Ålesund, from that month, and the route rebuilt before he sails on', () => {
    // Setting out on 1 August reaches Ålesund in mid October: no Geiranger.
    const autumn = walkAll(new Date(2026, 7, 1, 9, 0).getTime());
    const ids = autumn.state.arrivals.map((a) => a.placeId);
    expect(ids).toContain('alesund');
    expect(ids).not.toContain('geiranger');
    expect(ids[ids.length - 1]).toBe('tromso');
    expect(autumn.state.skipped).toEqual(['geiranger']);
    expect(autumn.route.places).toHaveLength(42);
    const reachedAlesund = autumn.state.arrivals.find((a) => a.placeId === 'alesund')!.at;
    expect(new Date(reachedAlesund).getMonth() + 1).toBe(10);
    // Setting out on 1 March reaches Ålesund in May: Geiranger is on the way.
    const spring = walkAll(new Date(2026, 2, 1, 9, 0).getTime());
    expect(spring.state.arrivals.map((a) => a.placeId)).toContain('geiranger');
    expect(spring.state.skipped).toBeUndefined();
    expect(spring.route.places).toHaveLength(43);
  });

  it('takes about 88 days end to end, 85 with Geiranger left out', () => {
    const spring = walkAll(new Date(2026, 2, 1, 9, 0).getTime());
    const last = spring.state.arrivals[spring.state.arrivals.length - 1];
    const days = (last.at - spring.start) / DAY;
    expect(days).toBeGreaterThan(84);
    expect(days).toBeLessThan(92);
    const autumn = walkAll(new Date(2026, 7, 1, 9, 0).getTime());
    const lastA = autumn.state.arrivals[autumn.state.arrivals.length - 1];
    expect((lastA.at - autumn.start) / DAY).toBeLessThan(days);
    // In Norway each stop rests a day and a half.
    const oslo = spring.state.arrivals.find((a) => a.placeId === 'oslo')!;
    const finse = spring.state.arrivals.find((a) => a.placeId === 'finse')!;
    expect(finse.at - oslo.at).toBeGreaterThan(1.5 * DAY);
  });

  it('keeps an old save whole: no skipped field, then the same route again from the saved skips', () => {
    const old: JourneyState = { ...startJourney(NORTH_LIGHT, 1_000), home: null, from: null, walked: [TO_THE_SEA.id] };
    expect(isJourneyState(old)).toBe(true);
    expect(isJourneyState({ ...old, skipped: ['geiranger'] })).toBe(true);
    expect(isJourneyState({ ...old, skipped: [3] })).toBe(false);
    expect(buildSegmentRoute(old, ROUTES)?.places).toHaveLength(43);
    const rebuilt = buildSegmentRoute({ ...old, skipped: ['geiranger'] }, ROUTES)!;
    expect(rebuilt.places.map((p) => p.id)).not.toContain('geiranger');
    expect(rebuilt.id).toBe(NORTH_LIGHT.id);
  });
});

describe('the chain and the long line (ruling 19)', () => {
  it('never starts a journey on the long line', () => {
    for (const origin of [{ lat: 38.7, lon: -9.1 }, { lat: 51.5, lon: -0.1 }, { lat: 40.4, lon: -3.7 }]) {
      expect(outsetDestination(ROUTES, origin).long).toBeFalsy();
    }
  });

  it('comes after the first short route, by plane from where it ended, and then the chain goes on', () => {
    const route = routeFromHome(TO_THE_SEA, BRIGHTON);
    const journey: JourneyState = { ...startJourney(route, 0), home: BRIGHTON, walked: [] };
    const t = 365 * DAY;
    const done = advance(route, journey, t).state;
    expect(locate(route, done, t).finished).toBe(true);
    const seg = nextSegment(done, route, ROUTES, t);
    expect(seg.route.id).toBe(NORTH_LIGHT.id);
    expect(seg.route.places[0].name).toBe('Seven Sisters');
    expect(seg.route.places[1].id).toBe('lisbon');
    expect(seg.route.legs[0].mode).toBe('fly');
    expect(seg.journey.walked).toEqual([TO_THE_SEA.id]);
    expect(departureNote(seg.route.legs[0].mode!, 'Lisbon')).toBe('Off again, flying to Lisbon.');
    // After the North: on to the nearest short route not yet walked, not the long line again.
    const t2 = t + 400 * DAY;
    const far = advanceAlong((s) => buildSegmentRoute(s, ROUTES)!, seg.journey, t2, utc);
    expect(far.state.arrivals[far.state.arrivals.length - 1].placeId).toBe('tromso');
    const after = nextSegment(far.state, far.route, ROUTES, t2);
    expect(after.route.long).toBeFalsy();
    expect(after.journey.walked).toEqual([TO_THE_SEA.id, NORTH_LIGHT.id]);
    expect(after.route.places[0].name).toBe('Tromsø');
  });

  it('shows the long line on the map with the way to it', () => {
    const route = routeFromHome(TO_THE_SEA, BRIGHTON);
    const journey: JourneyState = { ...startJourney(route, 0), home: BRIGHTON, walked: [] };
    const option = routeOptions(journey, route, ROUTES).find((o) => o.route.id === NORTH_LIGHT.id)!;
    expect(option.mode).toBe('fly');
    expect(option.km).toBeGreaterThan(1500);
  });
});

describe('the end by season (ruling 24)', () => {
  it('is the northern lights from 1 September to 10 April, the midnight sun from 20 May to 22 July, the bright night between', () => {
    expect(endingSeason(new Date(2026, 8, 1))).toBe('aurora');
    expect(endingSeason(new Date(2026, 11, 25))).toBe('aurora');
    expect(endingSeason(new Date(2027, 3, 10))).toBe('aurora');
    expect(endingSeason(new Date(2027, 3, 11))).toBe('brightNight');
    expect(endingSeason(new Date(2027, 4, 19))).toBe('brightNight');
    expect(endingSeason(new Date(2027, 4, 20))).toBe('midnightSun');
    expect(endingSeason(new Date(2027, 6, 22))).toBe('midnightSun');
    expect(endingSeason(new Date(2027, 6, 23))).toBe('brightNight');
    expect(endingSeason(new Date(2027, 7, 31))).toBe('brightNight');
  });

  it('has a letter for each of the three, in both languages, at Tromsø only', () => {
    const tromso = NORTH_LIGHT.places[42];
    expect(Object.keys(tromso.endings ?? {}).sort()).toEqual(['aurora', 'brightNight', 'midnightSun']);
    for (const l of Object.values(tromso.endings!)) {
      expect(l.en.length).toBeGreaterThan(0);
      expect(l.zh.length).toBeGreaterThan(0);
    }
    expect(NORTH_LIGHT.places.filter((p) => p.endings)).toHaveLength(1);
  });
});
