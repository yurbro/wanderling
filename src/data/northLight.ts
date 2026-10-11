import type { EndingSeason, Leg, LegMode, Place, Route, Terrain } from '../core/types';
import data from '../../docs/routes/north-light-v1.json';

/**
 * The long main line, "North Light" (decisions D6; section 9, rulings 23 to
 * 25): Lisbon up the Atlantic coast, across France, the Alps and the Rhine,
 * a night ferry to Norway and the coastal ship past the Arctic Circle to
 * Tromsø. Forty-three places, about 88 days. The data file in docs/routes
 * is the one source; this file only turns it into a Route.
 */

const COUNTRY_ZH: Record<string, string> = {
  Portugal: '葡萄牙',
  Spain: '西班牙',
  France: '法国',
  Switzerland: '瑞士',
  Germany: '德国',
  Denmark: '丹麦',
  Norway: '挪威',
};

interface DataPlace {
  order: number;
  id: string;
  name: { en: string; zh: string };
  country: string;
  lat: number;
  lon: number;
  terrain: Terrain;
  arriveBy: 'arrive' | 'walk' | 'train' | 'ferry' | 'ship';
  legKm: number;
  restDays: number;
  estDay: number;
  line: { en: string; zh: string };
  months?: number[];
  note?: string;
  ending?: Record<string, string>;
  endingLetters?: Record<EndingSeason, { en: string; zh: string }>;
}

const MODE: Record<DataPlace['arriveBy'], LegMode> = { arrive: 'walk', walk: 'walk', train: 'ride', ferry: 'ferry', ship: 'ship' };

/** What the land looks like on the way: fields on a train, the sea on a boat, on foot the country one walks into. */
function legTerrain(from: DataPlace, to: DataPlace): Terrain {
  switch (to.arriveBy) {
    case 'train':
      // From the window: the land the line runs through, which is the ends' unless both are cities.
      return from.terrain !== 'city' ? from.terrain : to.terrain !== 'city' ? to.terrain : 'plain';
    case 'ferry':
    case 'ship':
      return 'coast';
    default:
      // Walking into a town is mostly fields and the land one left.
      return to.terrain === 'city' ? (from.terrain === 'city' ? 'plain' : from.terrain) : to.terrain;
  }
}

function build(): Route {
  const raw = (data as { places: DataPlace[] }).places.slice().sort((a, b) => a.order - b.order);
  const places: Place[] = raw.map((p) => ({
    id: p.id,
    name: p.name.en,
    region: p.country,
    terrain: p.terrain,
    lat: p.lat,
    lon: p.lon,
    note: p.line.en,
    zh: { name: p.name.zh, region: COUNTRY_ZH[p.country] ?? p.country, note: p.line.zh },
    restDays: p.restDays,
    ...(p.months ? { months: p.months } : {}),
    ...(p.endingLetters ? { endings: p.endingLetters } : {}),
  }));
  const legs: Leg[] = raw.slice(1).map((p, i) => ({ km: p.legKm, terrain: legTerrain(raw[i], p), mode: MODE[p.arriveBy] }));
  return { id: data.route, name: data.title.en, nameZh: data.title.zh, places, legs, long: true };
}

export const NORTH_LIGHT: Route = build();
