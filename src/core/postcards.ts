import { getLang, placeName, placeNote, placeRegion, t } from './i18n';
import { direct } from './sceneDirector';
import { haversineKm } from './geo';
import type { Arrival, GeoPoint, Home, JourneyState, Place, Postcard, Route, WeatherCondition, WeatherState } from './types';
import { buildWorldState } from './world';

/**
 * Postcards: one per arrival, made from the sky and weather of that moment.
 * Pure functions; the store and the album live elsewhere.
 */

export function postcardId(routeId: string, arrival: Arrival): string {
  return `${routeId}:${arrival.placeId}:${arrival.at}`;
}

/** Arrivals in the journey that have no postcard yet, in order. */
export function missingArrivals(route: Route, journey: JourneyState, cards: Postcard[]): Arrival[] {
  const have = new Set(cards.map((c) => c.id));
  return journey.arrivals.filter((a) => !have.has(postcardId(route.id, a)));
}

const HOUR_MS = 3_600_000;
/** Slow post: at least this long, and up to this long from the far side of the world. */
export const DELIVERY_MIN_MS = 3 * HOUR_MS;
export const DELIVERY_MAX_MS = 48 * HOUR_MS;
/** A card from this far away takes the full two days. */
const DELIVERY_FAR_KM = 1500;
/** When neither home nor the place has coordinates. */
const DELIVERY_UNKNOWN_MS = 6 * HOUR_MS;

/**
 * How long a postcard takes to arrive from `km` away: three hours from next
 * door, two days from 1500 km or more, in between in proportion. Null km
 * (no coordinates) gets a modest default.
 */
export function deliveryDelayMs(km: number | null): number {
  if (km === null) return DELIVERY_UNKNOWN_MS;
  const far = Math.min(1, Math.max(0, km) / DELIVERY_FAR_KM);
  return Math.round(DELIVERY_MIN_MS + (DELIVERY_MAX_MS - DELIVERY_MIN_MS) * far);
}

/** The distance a card travels: from the place to home, when both are known. */
export function postingDistanceKm(place: Place, home: Home | null | undefined): number | null {
  if (!home || typeof place.lat !== 'number' || typeof place.lon !== 'number') return null;
  return haversineKm({ lat: place.lat, lon: place.lon }, home);
}

/** Cards that have reached the person by `now` (old cards without a delivery time count). */
export function deliveredCards(cards: Postcard[], now: number): Postcard[] {
  return cards.filter((c) => c.deliverAt === undefined || c.deliverAt <= now);
}

/** Cards still in the post at `now`. */
export function pendingCards(cards: Postcard[], now: number): Postcard[] {
  return cards.filter((c) => c.deliverAt !== undefined && c.deliverAt > now);
}

export interface PostcardOptions {
  /** Where the card is going; sets the delivery delay. */
  home?: Home | null;
  /** Demo: hand the card over at once. */
  deliverNow?: boolean;
  /** The place he set out from: no slow post, it is home's own card (distance 0). */
  departure?: boolean;
}

/**
 * Is this arrival the journey's setting-out place? Its card is handed over as
 * the journey begins, so the album is never empty on the first day (review 3,
 * ruling 5). A chained segment starts without such an arrival, so only the
 * very first place of a fresh journey counts.
 */
export function isDeparture(route: Route, journey: JourneyState, arrival: Arrival): boolean {
  return arrival.placeId === route.places[0]?.id && arrival.at === journey.startedAt;
}

/**
 * Make the postcard for an arrival. The sky is computed for the arrival
 * moment at the person's own location (the postcard shows "your sky then"),
 * and the weather is whatever was known for that moment. The card is posted
 * on arrival and delivered later, by distance.
 */
export function makePostcard(
  route: Route,
  arrival: Arrival,
  location: GeoPoint,
  weather: WeatherState | null,
  opts: PostcardOptions = {},
): Postcard | null {
  const place = route.places.find((p) => p.id === arrival.placeId);
  if (!place) return null;
  const at = new Date(arrival.at);
  const rs = direct(buildWorldState(at, location, weather, null));
  const seaAmount = place.terrain === 'coast' ? 1 : place.terrain === 'lake' ? 0.7 : 0;
  const deliverAt = opts.deliverNow || opts.departure ? arrival.at : arrival.at + deliveryDelayMs(postingDistanceKm(place, opts.home));
  return {
    id: postcardId(route.id, arrival),
    routeId: route.id,
    placeId: place.id,
    placeName: placeName(place),
    region: placeRegion(place),
    terrain: place.terrain,
    at: arrival.at,
    deliverAt,
    note: placeNote(place),
    weather: weather
      ? { condition: weather.condition, code: weather.code, temperature: weather.temperature }
      : null,
    ...(opts.departure ? { departure: true } : {}),
    colors: {
      skyTop: rs.sky.top,
      skyHorizon: rs.sky.horizon,
      hillFar: rs.hills.far,
      hillNear: rs.hills.near,
      ground: rs.ground,
      sea: rs.land.seaColor,
    },
    darkInk: rs.darkInk,
    seaAmount,
    sky: {
      sunX: rs.sun.x, sunY: rs.sun.y, sunUp: rs.sun.visible && rs.sun.alpha > 0.3,
      moonX: rs.moon.x, moonY: rs.moon.y, moonUp: rs.moon.visible && rs.moon.alpha > 0.3, moonFraction: rs.moon.fraction,
      starAlpha: rs.starAlpha, cloud: rs.weather.cloud,
    },
  };
}

const MOOD: Record<WeatherCondition, { en: string; zh: string }> = {
  clear: { en: 'clear', zh: '晴朗的' },
  'partly-cloudy': { en: 'soft', zh: '多云的' },
  overcast: { en: 'grey', zh: '阴沉的' },
  fog: { en: 'foggy', zh: '有雾的' },
  drizzle: { en: 'drizzly', zh: '飘着毛毛雨的' },
  rain: { en: 'rainy', zh: '下着雨的' },
  'heavy-rain': { en: 'wet', zh: '大雨的' },
  thunderstorm: { en: 'stormy', zh: '雷雨的' },
  snow: { en: 'snowy', zh: '下着雪的' },
  'heavy-snow': { en: 'snowy', zh: '大雪的' },
};

export function timeOfDayWord(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** "A rainy afternoon · 11°", or just "Afternoon" when the weather is unknown. */
export function describeArrival(card: Postcard, unit: 'C' | 'F' = 'C'): string {
  const todKey = timeOfDayWord(new Date(card.at).getHours());
  const tod = t(todKey);
  if (!card.weather) return getLang() === 'zh' ? tod : tod.charAt(0).toUpperCase() + tod.slice(1);
  const deg = unit === 'F' ? card.weather.temperature * 1.8 + 32 : card.weather.temperature;
  const mood = MOOD[card.weather.condition][getLang()];
  return getLang() === 'zh' ? `${mood}${tod} · ${Math.round(deg)}°` : `A ${mood} ${tod} · ${Math.round(deg)}°`;
}

/** The stamp in the corner: a tiny glyph for the weather. */
export function stampGlyph(card: Postcard): string {
  if (!card.weather) return '✦';
  switch (card.weather.condition) {
    case 'clear':
      return '☀';
    case 'partly-cloudy':
    case 'overcast':
    case 'fog':
      return '☁';
    case 'drizzle':
    case 'rain':
    case 'heavy-rain':
    case 'thunderstorm':
      return '☂';
    default:
      return '❄';
  }
}

/** Sample cards for the demo panel, so the album can be seen before any journey. */
export function demoPostcards(route: Route, location: GeoPoint, now: number): Postcard[] {
  const picks: { place: Place; hoursAgo: number; weather: WeatherState | null }[] = [];
  const base = (condition: WeatherCondition, code: number, temperature: number, at: number): WeatherState => ({
    condition,
    code,
    temperature,
    cloudCover: 0.5,
    windSpeed: 10,
    windDirection: 250,
    precipitation: 0,
    time: new Date(at),
    source: 'demo',
  });
  const specs: [number, number, WeatherCondition, number, number][] = [
    [0, 50, 'clear', 0, 16],
    [1, 38, 'rain', 63, 11],
    [2, 20, 'overcast', 3, 9],
  ];
  for (const [i, hoursAgo, cond, code, temp] of specs) {
    const place = route.places[Math.min(i, route.places.length - 1)];
    const at = now - hoursAgo * 3_600_000;
    picks.push({ place, hoursAgo, weather: base(cond, code, temp, at) });
  }
  return picks
    .map(({ place, hoursAgo, weather }) =>
      makePostcard(route, { placeId: place.id, at: now - hoursAgo * 3_600_000 }, location, weather, { deliverNow: true }),
    )
    .filter((c): c is Postcard => c !== null);
}
