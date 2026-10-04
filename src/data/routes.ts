import type { Route } from '../core/types';

/**
 * The first route: out of London and down to the sea. Real places, rough
 * walking distances between them. Terrain tells the scene what to draw;
 * notes are what the wanderer says on arrival.
 */
export const TO_THE_SEA: Route = {
  id: 'to-the-sea-v1',
  name: 'To the Sea',
  places: [
    { id: 'london', name: 'London', region: 'England', terrain: 'city', lat: 51.51, lon: -0.13, note: 'Boots laced. Off we go.' },
    { id: 'richmond', name: 'Richmond Park', region: 'London', terrain: 'forest', lat: 51.44, lon: -0.27, note: 'Deer in the bracken. They let me pass.' },
    { id: 'box-hill', name: 'Box Hill', region: 'Surrey', terrain: 'hills', lat: 51.25, lon: -0.31, note: 'Up on the chalk, the whole valley below.' },
    { id: 'leith-hill', name: 'Leith Hill', region: 'Surrey', terrain: 'forest', lat: 51.18, lon: -0.37, note: 'A tower in the woods. On a clear day you can see the Channel.' },
    { id: 'horsham', name: 'Horsham', region: 'West Sussex', terrain: 'plain', lat: 51.06, lon: -0.33, note: 'Market day. I bought an apple.' },
    { id: 'devils-dyke', name: "Devil's Dyke", region: 'South Downs', terrain: 'hills', lat: 50.88, lon: -0.21, note: 'The Downs roll like a green sea. The real one is close now.' },
    { id: 'brighton', name: 'Brighton', region: 'East Sussex', terrain: 'coast', lat: 50.82, lon: -0.14, note: 'The sea. I sat on the pebbles until the light went.' },
    { id: 'seven-sisters', name: 'Seven Sisters', region: 'East Sussex', terrain: 'coast', lat: 50.75, lon: 0.15, note: 'White cliffs, grey water, a long way down.' },
  ],
  legs: [
    { km: 13, terrain: 'city' },
    { km: 30, terrain: 'plain' },
    { km: 12, terrain: 'hills' },
    { km: 22, terrain: 'forest' },
    { km: 30, terrain: 'plain' },
    { km: 12, terrain: 'hills' },
    { km: 25, terrain: 'coast' },
  ],
};

/** Out of Tokyo, along the Shonan coast and up into the hot-spring hills. */
export const TO_THE_HOT_SPRINGS: Route = {
  id: 'tokyo-hot-springs-v1',
  name: 'To the Hot Springs',
  places: [
    { id: 'tokyo', name: 'Tokyo', region: 'Japan', terrain: 'city', lat: 35.68, lon: 139.69, note: 'The city hums behind me. I take the river road south.' },
    { id: 'kamakura', name: 'Kamakura', region: 'Kanagawa', terrain: 'hills', lat: 35.32, lon: 139.55, note: 'Old temples in the trees, salt in the air.' },
    { id: 'enoshima', name: 'Enoshima', region: 'Kanagawa', terrain: 'coast', lat: 35.3, lon: 139.48, note: 'An island at the end of a bridge. The sea, at last.' },
    { id: 'odawara', name: 'Odawara', region: 'Kanagawa', terrain: 'city', lat: 35.26, lon: 139.15, note: 'A castle by the station. I ate a fish cake on the steps.' },
    { id: 'hakone-yumoto', name: 'Hakone-Yumoto', region: 'Kanagawa', terrain: 'mountain', lat: 35.23, lon: 139.11, note: 'Steam rising off the river. Everyone walks slowly here.' },
    { id: 'lake-ashi', name: 'Lake Ashi', region: 'Hakone', terrain: 'lake', lat: 35.2, lon: 139.03, note: 'A red gate standing in the water, Fuji behind the clouds.' },
    { id: 'atami', name: 'Atami', region: 'Shizuoka', terrain: 'coast', lat: 35.1, lon: 139.07, note: 'Down to the warm sea. Feet in the water, journey done.' },
  ],
  legs: [
    { km: 50, terrain: 'plain' },
    { km: 8, terrain: 'coast' },
    { km: 35, terrain: 'coast' },
    { km: 8, terrain: 'hills' },
    { km: 14, terrain: 'mountain' },
    { km: 20, terrain: 'mountain' },
  ],
};

/** Down the Seine from Paris to the chalk cliffs of Normandy. */
export const DOWN_THE_SEINE: Route = {
  id: 'paris-seine-v1',
  name: 'Down the Seine',
  places: [
    { id: 'paris', name: 'Paris', region: 'France', terrain: 'city', lat: 48.86, lon: 2.35, note: 'Bread for the road. The river will show me the way.' },
    { id: 'giverny', name: 'Giverny', region: 'Normandy', terrain: 'plain', lat: 49.08, lon: 1.53, note: 'Lily ponds. I stood on the green bridge for a long time.' },
    { id: 'rouen', name: 'Rouen', region: 'Normandy', terrain: 'hills', lat: 49.44, lon: 1.1, note: 'A cathedral in every light, like the painter said.' },
    { id: 'honfleur', name: 'Honfleur', region: 'Normandy', terrain: 'coast', lat: 49.42, lon: 0.23, note: 'Slate houses leaning over the old harbour.' },
    { id: 'etretat', name: 'Étretat', region: 'Normandy', terrain: 'coast', lat: 49.71, lon: 0.2, note: 'White arches standing in the sea. Journey done.' },
  ],
  legs: [
    { km: 75, terrain: 'plain' },
    { km: 65, terrain: 'hills' },
    { km: 90, terrain: 'forest' },
    { km: 45, terrain: 'coast' },
  ],
};

export const ROUTES: Route[] = [TO_THE_SEA, TO_THE_HOT_SPRINGS, DOWN_THE_SEINE];

export function routeById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
