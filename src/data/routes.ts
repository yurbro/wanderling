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

export const ROUTES: Route[] = [TO_THE_SEA];

export function routeById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
