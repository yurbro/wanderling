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

/** North along the Hudson from New York into the Catskills. */
export const UP_THE_HUDSON: Route = {
  id: 'hudson-v1',
  name: 'Up the Hudson',
  places: [
    { id: 'new-york', name: 'New York', region: 'United States', terrain: 'city', lat: 40.71, lon: -74.01, note: 'Out through the steam and the sirens. The river points north.' },
    { id: 'tarrytown', name: 'Tarrytown', region: 'New York', terrain: 'forest', lat: 41.08, lon: -73.86, note: 'Headless horsemen on the signs. I kept my hat on.' },
    { id: 'cold-spring', name: 'Cold Spring', region: 'New York', terrain: 'hills', lat: 41.42, lon: -73.95, note: 'The river squeezed between mountains. A freight train went by for ten minutes.' },
    { id: 'hyde-park', name: 'Hyde Park', region: 'New York', terrain: 'plain', lat: 41.79, lon: -73.93, note: 'Apple stands by the road. I had two.' },
    { id: 'rhinebeck', name: 'Rhinebeck', region: 'New York', terrain: 'plain', lat: 41.93, lon: -73.91, note: 'A town with a bandstand. Someone was practising the trumpet.' },
    { id: 'woodstock', name: 'Woodstock', region: 'Catskills', terrain: 'mountain', lat: 42.04, lon: -74.12, note: 'Up into the Catskills. Mist in the trees, a dog on every porch.' },
  ],
  legs: [
    { km: 42, terrain: 'city' },
    { km: 40, terrain: 'forest' },
    { km: 45, terrain: 'hills' },
    { km: 18, terrain: 'plain' },
    { km: 30, terrain: 'forest' },
  ],
};

/** Down the coast from San Francisco to Big Sur. */
export const PACIFIC_COAST: Route = {
  id: 'pacific-coast-v1',
  name: 'Down the Pacific Coast',
  places: [
    { id: 'san-francisco', name: 'San Francisco', region: 'California', terrain: 'city', lat: 37.77, lon: -122.42, note: 'Fog on the bridge, sun on the hills. Both at once.' },
    { id: 'half-moon-bay', name: 'Half Moon Bay', region: 'California', terrain: 'coast', lat: 37.46, lon: -122.43, note: 'Pumpkin fields running down to the surf.' },
    { id: 'santa-cruz', name: 'Santa Cruz', region: 'California', terrain: 'coast', lat: 36.97, lon: -122.03, note: 'A wooden roller coaster rattling over the beach.' },
    { id: 'monterey', name: 'Monterey', region: 'California', terrain: 'coast', lat: 36.6, lon: -121.89, note: 'Sea otters floating on their backs, cracking shells.' },
    { id: 'big-sur', name: 'Big Sur', region: 'California', terrain: 'mountain', lat: 36.27, lon: -121.81, note: 'Cliffs falling straight into the ocean. I walked slowly on purpose.' },
  ],
  legs: [
    { km: 45, terrain: 'coast' },
    { km: 75, terrain: 'coast' },
    { km: 70, terrain: 'coast' },
    { km: 45, terrain: 'mountain' },
  ],
};

/** Out of Melbourne along the Great Ocean Road. */
export const GREAT_OCEAN: Route = {
  id: 'great-ocean-v1',
  name: 'The Great Ocean Road',
  places: [
    { id: 'melbourne', name: 'Melbourne', region: 'Australia', terrain: 'city', lat: -37.81, lon: 144.96, note: 'Trams and laneways. Coffee for the road.' },
    { id: 'geelong', name: 'Geelong', region: 'Victoria', terrain: 'plain', lat: -38.15, lon: 144.36, note: 'A long flat walk. Sheep, then more sheep.' },
    { id: 'torquay', name: 'Torquay', region: 'Victoria', terrain: 'coast', lat: -38.33, lon: 144.32, note: 'Surfboards on every car. The ocean, loud.' },
    { id: 'lorne', name: 'Lorne', region: 'Victoria', terrain: 'coast', lat: -38.54, lon: 143.98, note: 'Cockatoos screaming in the gums above the beach.' },
    { id: 'apollo-bay', name: 'Apollo Bay', region: 'Victoria', terrain: 'forest', lat: -38.76, lon: 143.67, note: 'Tree ferns and a koala asleep in a fork.' },
    { id: 'twelve-apostles', name: 'Twelve Apostles', region: 'Victoria', terrain: 'coast', lat: -38.66, lon: 143.1, note: 'Stone towers standing in the surf. Journey done.' },
  ],
  legs: [
    { km: 75, terrain: 'plain' },
    { km: 25, terrain: 'coast' },
    { km: 45, terrain: 'coast' },
    { km: 45, terrain: 'forest' },
    { km: 90, terrain: 'coast' },
  ],
};

/** From Shanghai through the water towns to West Lake and the hills beyond. */
export const JIANGNAN_WATERS: Route = {
  id: 'jiangnan-v1',
  name: 'Jiangnan Waters',
  places: [
    { id: 'shanghai', name: 'Shanghai', region: 'China', terrain: 'city', lat: 31.23, lon: 121.47, note: 'Left the towers behind before the breakfast stalls opened.' },
    { id: 'zhujiajiao', name: 'Zhujiajiao', region: 'Shanghai', terrain: 'lake', lat: 31.11, lon: 121.05, note: 'Stone bridges and a boatman singing to nobody.' },
    { id: 'suzhou', name: 'Suzhou', region: 'Jiangsu', terrain: 'city', lat: 31.3, lon: 120.62, note: 'Gardens within gardens. I lost an hour in one.' },
    { id: 'taihu', name: 'Lake Tai', region: 'Jiangsu', terrain: 'lake', lat: 31.2, lon: 120.3, note: 'A lake like a sea, fishing boats at the edge of sight.' },
    { id: 'hangzhou', name: 'West Lake', region: 'Hangzhou', terrain: 'lake', lat: 30.25, lon: 120.14, note: 'Willows, a causeway, tea in a paper cup.' },
    { id: 'moganshan', name: 'Moganshan', region: 'Zhejiang', terrain: 'mountain', lat: 30.6, lon: 119.86, note: 'Bamboo to the top of the hill. Quiet enough to hear it grow.' },
  ],
  legs: [
    { km: 48, terrain: 'plain' },
    { km: 55, terrain: 'lake' },
    { km: 35, terrain: 'plain' },
    { km: 130, terrain: 'lake' },
    { km: 60, terrain: 'hills' },
  ],
};

export const ROUTES: Route[] = [TO_THE_SEA, TO_THE_HOT_SPRINGS, DOWN_THE_SEINE, UP_THE_HUDSON, PACIFIC_COAST, GREAT_OCEAN, JIANGNAN_WATERS];

export function routeById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
