import { getLang, placeName, placeNote, placeRegion, t } from './i18n';
import { direct } from './sceneDirector';
import type { Arrival, GeoPoint, JourneyState, Place, Postcard, Route, WeatherCondition, WeatherState } from './types';
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

/**
 * Make the postcard for an arrival. The sky is computed for the arrival
 * moment at the person's own location (the postcard shows "your sky then"),
 * and the weather is whatever was known for that moment.
 */
export function makePostcard(
  route: Route,
  arrival: Arrival,
  location: GeoPoint,
  weather: WeatherState | null,
): Postcard | null {
  const place = route.places.find((p) => p.id === arrival.placeId);
  if (!place) return null;
  const at = new Date(arrival.at);
  const rs = direct(buildWorldState(at, location, weather, null));
  const seaAmount = place.terrain === 'coast' ? 1 : place.terrain === 'lake' ? 0.7 : 0;
  return {
    id: postcardId(route.id, arrival),
    routeId: route.id,
    placeId: place.id,
    placeName: placeName(place),
    region: placeRegion(place),
    terrain: place.terrain,
    at: arrival.at,
    note: placeNote(place),
    weather: weather
      ? { condition: weather.condition, code: weather.code, temperature: weather.temperature }
      : null,
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
      makePostcard(route, { placeId: place.id, at: now - hoursAgo * 3_600_000 }, location, weather),
    )
    .filter((c): c is Postcard => c !== null);
}
