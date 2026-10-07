import { Assets, Texture } from 'pixi.js';
import type { Terrain } from '../core/types';

/**
 * The terrain kit: hand-drawn pictures the renderer hangs its layers on
 * (docs/design/art/terrain-kit.md). Each terrain has four grey bands (far,
 * mid and near hills, and the ground's edge) that the renderer tints with
 * the sky's colours; the props are shared and carry their own colours.
 *
 * Bands load per terrain, on first use, so a journey only fetches the
 * landscapes it walks through. Until a set has loaded the renderer draws
 * its own flat shapes, so nothing waits on the network.
 */

export const BAND_NAMES = ['far', 'mid', 'near', 'ground'] as const;
export type BandName = (typeof BAND_NAMES)[number];
export type BandSet = Record<BandName, Texture>;

/** Terrains that have a painted band set so far; the rest borrow hills. */
const PAINTED: ReadonlySet<Terrain> = new Set<Terrain>(['hills', 'lake', 'coast', 'forest', 'mountain', 'plain', 'desert', 'city']);

/** The band set to paint a terrain with. */
export function bandSetFor(terrain: Terrain): Terrain {
  return PAINTED.has(terrain) ? terrain : 'hills';
}

/** Props that belong to one terrain and stand by the path there (docs/design/art/terrain-kit.md). */
export const TERRAIN_EXTRAS: Record<Terrain, string[]> = {
  hills: [],
  plain: ['hay-bale', 'haystack'],
  mountain: ['bridge', 'stone-pile'],
  forest: ['mushrooms', 'stump'],
  coast: ['lighthouse', 'boat'],
  lake: ['jetty', 'reeds'],
  desert: ['cactus', 'shrub'],
  city: ['bench', 'postbox'],
};
/** How tall each extra stands, as a fraction of the ground's height. */
export const EXTRA_HEIGHT: Record<string, number> = {
  'hay-bale': 0.11, haystack: 0.14, bridge: 0.12, 'stone-pile': 0.08, mushrooms: 0.07, stump: 0.09,
  lighthouse: 0.26, boat: 0.09, jetty: 0.11, reeds: 0.12, cactus: 0.18, shrub: 0.09, bench: 0.1, postbox: 0.14,
};
const EXTRA_NAMES = Object.values(TERRAIN_EXTRAS).flat();

const PROP_NAMES = [
  'grass-1', 'grass-2', 'grass-3', 'grass-4',
  'stone-1', 'stone-2', 'stone-3',
  'flower-1', 'flower-2', 'flower-3',
  'cloud-1', 'cloud-2', 'cloud-3', 'cloud-4',
  'signpost', 'lamp', 'cottage',
] as const;
type PropName = (typeof PROP_NAMES)[number];

export interface TerrainProps {
  grass: Texture[];
  stones: Texture[];
  flowers: Texture[];
  clouds: Texture[];
  signpost: Texture;
  lamp: Texture;
  cottage: Texture;
  /** The terrain extras by name. */
  extras: Record<string, Texture>;
}

const base = (): string => `${import.meta.env.BASE_URL}art/terrain/`;

function prepare(tex: Texture, repeat: boolean): Texture {
  tex.source.autoGenerateMipmaps = true;
  tex.source.scaleMode = 'linear';
  // The bands repeat sideways: each is a picture plus its mirror, so the seam is invisible.
  if (repeat) tex.source.addressMode = 'repeat';
  tex.source.update();
  return tex;
}

const bandPromises = new Map<Terrain, Promise<BandSet>>();

/** Load a terrain's four bands once. */
export function loadBands(terrain: Terrain): Promise<BandSet> {
  const key = bandSetFor(terrain);
  let p = bandPromises.get(key);
  if (!p) {
    p = Promise.all(BAND_NAMES.map((n) => Assets.load<Texture>(`${base()}${key}-${n}.png`))).then((all) => {
      const set = {} as BandSet;
      BAND_NAMES.forEach((n, i) => (set[n] = prepare(all[i], true)));
      return set;
    });
    bandPromises.set(key, p);
  }
  return p;
}

let propsPromise: Promise<TerrainProps> | null = null;

/** Load the shared props once. */
export function loadProps(): Promise<TerrainProps> {
  if (!propsPromise) {
    const names = [...PROP_NAMES, ...EXTRA_NAMES];
    propsPromise = Promise.all(names.map((n) => Assets.load<Texture>(`${base()}${n}.png`))).then((all) => {
      const props = {} as Record<PropName, Texture>;
      PROP_NAMES.forEach((n, i) => (props[n] = prepare(all[i], false)));
      const extras: Record<string, Texture> = {};
      EXTRA_NAMES.forEach((n, i) => (extras[n] = prepare(all[PROP_NAMES.length + i], false)));
      return {
        grass: [props['grass-1'], props['grass-2'], props['grass-3'], props['grass-4']],
        stones: [props['stone-1'], props['stone-2'], props['stone-3']],
        flowers: [props['flower-1'], props['flower-2'], props['flower-3']],
        clouds: [props['cloud-1'], props['cloud-2'], props['cloud-3'], props['cloud-4']],
        signpost: props.signpost,
        lamp: props.lamp,
        cottage: props.cottage,
        extras,
      };
    });
  }
  return propsPromise;
}
