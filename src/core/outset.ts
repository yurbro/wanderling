import { haversineKm, homeNote, nearestRoute } from './geo';
import { KM_PER_HOUR, REST_MS, awakeMs, localNights, type SleepClock } from './journey';
import type { Home, Leg, Place, Route } from './types';

/**
 * The going-out stretch (decisions.md section 9, ruling 14): every new
 * journey starts on foot, whatever the nearest route begins with. About two
 * and a half days from the front door, past the fields, to a little station
 * in a small town; on the evening of day 3 a night train, and at dawn on
 * day 5 the first real place. That is the first week's script (review v2,
 * section 4), so the first minute is always on the road, never in a carriage.
 *
 * Nothing here needs map data: the station is a point a walk away from home,
 * placed towards where the train will go. Its numbers are worked out once,
 * when the journey begins, and saved with it, so the route never shifts under
 * a journey already on its way.
 */

/** He reaches the station at 8:00 on day 3, rests there the day, and the train leaves at 20:00. */
export const STATION_DAY = 3;
export const STATION_HOUR = 8;
/** The night train gets in at 6:00 on day 5. */
export const TRAIN_ARRIVAL_DAY = 5;
export const TRAIN_ARRIVAL_HOUR = 6;
/**
 * The train goes to the nearest route at least this far from home: a route
 * that starts on the doorstep comes later in the chain instead of a pointless
 * ride back into town. (Until the long main line exists, roadmap item 9.)
 */
export const NIGHT_TRAIN_MIN_KM = 250;
/** Farther than this there is no train: a plane, at its own speed. */
export const NIGHT_TRAIN_MAX_KM = 3000;
/** Roads wind: the station is this fraction of the walk away as the crow flies. */
const ROAD_WIND = 0.8;

const HOUR_MS = 3_600_000;

/** Everything needed to rebuild the going-out stretch; saved in the journey. */
export interface Outset {
  /** Where he set out: the person's city, or the sky's place when it is not shared. */
  origin: Home;
  /** The little station, a walk from home. */
  station: { lat: number; lon: number };
  /** The walk to the station, in km. */
  walkKm: number;
  /** How long the night train takes, in hours (it runs to a timetable, not a speed). */
  trainHours: number;
}

/** The little station's name and the line on its postcard. */
export const STATION_PLACE = {
  id: 'station',
  en: { name: 'Little Station', note: 'One bench, one clock, one train a night.' },
  zh: { name: '小站', note: '一张长椅，一座钟，每晚一班火车。' },
};

/** The local time `days` calendar days after `from`, at `hour`:00. */
export function dayAt(from: number, days: number, hour: number): number {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, hour, 0, 0, 0).getTime();
}

/** The point `km` from `p` along a compass bearing in degrees. */
export function travel(p: { lat: number; lon: number }, bearing: number, km: number): { lat: number; lon: number } {
  const R = 6371;
  const rad = Math.PI / 180;
  const d = km / R;
  const b = bearing * rad;
  const lat1 = p.lat * rad;
  const lon1 = p.lon * rad;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  const lon = ((((lon2 / rad) + 540) % 360) - 180);
  return { lat: Math.round((lat2 / rad) * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

/** The compass bearing from `a` to `b`, degrees. */
export function bearingTo(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

/** The route the night train goes to: the nearest that is worth a train, else simply the nearest. */
export function outsetDestination(routes: Route[], origin: { lat: number; lon: number }): Route {
  const far = routes.filter((r) => {
    const p = r.places[0];
    return p && typeof p.lat === 'number' && typeof p.lon === 'number' && haversineKm(origin, { lat: p.lat, lon: p.lon }) >= NIGHT_TRAIN_MIN_KM;
  });
  return nearestRoute(far.length > 0 ? far : routes, origin).route;
}

/**
 * Plan the going-out stretch for a journey starting at `startAt`: a walk
 * sized so that he reaches the station at 8:00 on day 3 (his nights' sleep
 * counted), and a night train that leaves after his rest there and gets in
 * at 6:00 on day 5.
 */
export function planOutset(origin: Home, dest: { lat: number; lon: number } | null, startAt: number, sleep: SleepClock = localNights): Outset {
  const atStation = dayAt(startAt, STATION_DAY, STATION_HOUR);
  const walkKm = Math.round((awakeMs(startAt, atStation, sleep) / HOUR_MS) * KM_PER_HOUR * 100) / 100;
  const leaves = atStation + REST_MS;
  const arrives = dayAt(startAt, TRAIN_ARRIVAL_DAY, TRAIN_ARRIVAL_HOUR);
  const trainHours = Math.max(1, (arrives - leaves) / HOUR_MS);
  // Towards the train's destination when it is well beyond the walk; otherwise a
  // direction of its own, the same every time for the same home.
  const bearing = dest && haversineKm(origin, dest) > walkKm * 1.5 ? bearingTo(origin, dest) : seededBearing(origin);
  const station = travel(origin, bearing, walkKm * ROAD_WIND);
  return { origin, station, walkKm, trainHours };
}

function seededBearing(p: { lat: number; lon: number }): number {
  const s = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * The route as travelled: home, the walk to the little station, the night
 * train (or, beyond a train's reach, a plane), then the base route. The id
 * stays the base route's, like a transfer, so postcards and the chain work.
 */
export function withOutset(base: Route, outset: Outset): Route {
  const { origin, station } = outset;
  const home: Place = {
    id: 'home',
    name: origin.name,
    region: origin.region,
    terrain: 'city',
    lat: origin.lat,
    lon: origin.lon,
    note: homeNote(origin.name),
  };
  const stationPlace: Place = {
    id: STATION_PLACE.id,
    name: STATION_PLACE.en.name,
    region: origin.name,
    terrain: 'city',
    lat: station.lat,
    lon: station.lon,
    note: STATION_PLACE.en.note,
    zh: { name: STATION_PLACE.zh.name, region: origin.name, note: STATION_PLACE.zh.note },
  };
  // Past the fields: the leg is plain; the first tenth is home's lane and the last fifth the station's town.
  const walk: Leg = { km: outset.walkKm, terrain: 'plain', mode: 'walk' };
  const first = base.places[0];
  const trainKm = first && typeof first.lat === 'number' && typeof first.lon === 'number' ? Math.max(1, Math.round(haversineKm(station, { lat: first.lat, lon: first.lon }))) : 1;
  const train: Leg =
    trainKm > NIGHT_TRAIN_MAX_KM
      ? { km: trainKm, terrain: 'plain', mode: 'fly' }
      : { km: trainKm, terrain: 'plain', mode: 'ride', hours: outset.trainHours };
  return { ...base, places: [home, stationPlace, ...base.places], legs: [walk, train, ...base.legs] };
}

/** True for a leg that runs to a timetable (the night train). */
export function isNightTrain(leg: Leg | undefined): boolean {
  return !!leg && leg.mode === 'ride' && typeof leg.hours === 'number' && leg.hours > 0;
}
