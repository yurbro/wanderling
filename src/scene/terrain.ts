import { Assets, Texture } from 'pixi.js';

/**
 * The terrain kit: hand-drawn pictures the renderer hangs its layers on
 * (docs/design/art/terrain-kit.md). The bands are grey so the renderer can
 * tint them with the sky's colours; the props carry their own colours.
 *
 * Only the hills kit exists so far. Until it has loaded, the renderer draws
 * its own flat shapes, so nothing waits on the network.
 */

export const BAND_NAMES = ['far', 'mid', 'near', 'ground'] as const;
export type BandName = (typeof BAND_NAMES)[number];

const PROP_NAMES = [
  'grass-1', 'grass-2', 'grass-3', 'grass-4',
  'stone-1', 'stone-2', 'stone-3',
  'flower-1', 'flower-2', 'flower-3',
  'cloud-1', 'cloud-2', 'cloud-3', 'cloud-4',
  'signpost', 'lamp', 'cottage',
] as const;
type PropName = (typeof PROP_NAMES)[number];

export interface TerrainKit {
  bands: Record<BandName, Texture>;
  grass: Texture[];
  stones: Texture[];
  flowers: Texture[];
  clouds: Texture[];
  signpost: Texture;
  lamp: Texture;
  cottage: Texture;
}

let kitPromise: Promise<TerrainKit> | null = null;

/** Load the hills kit once; shared by everything that draws with it. */
export function loadTerrainKit(): Promise<TerrainKit> {
  if (!kitPromise) {
    const base = `${import.meta.env.BASE_URL}art/terrain/`;
    const bandUrls = BAND_NAMES.map((n) => `${base}hills-${n}.png`);
    const propUrls = PROP_NAMES.map((n) => `${base}${n}.png`);
    kitPromise = Promise.all([...bandUrls, ...propUrls].map((u) => Assets.load<Texture>(u))).then((all) => {
      for (const tex of all) {
        tex.source.autoGenerateMipmaps = true;
        tex.source.scaleMode = 'linear';
        tex.source.update();
      }
      const bands = {} as Record<BandName, Texture>;
      BAND_NAMES.forEach((n, i) => (bands[n] = all[i]));
      // The bands repeat sideways: they are drawn as a picture plus its mirror, so the seam is invisible.
      for (const n of BAND_NAMES) bands[n].source.addressMode = 'repeat';
      const props = {} as Record<PropName, Texture>;
      PROP_NAMES.forEach((n, i) => (props[n] = all[BAND_NAMES.length + i]));
      return {
        bands,
        grass: [props['grass-1'], props['grass-2'], props['grass-3'], props['grass-4']],
        stones: [props['stone-1'], props['stone-2'], props['stone-3']],
        flowers: [props['flower-1'], props['flower-2'], props['flower-3']],
        clouds: [props['cloud-1'], props['cloud-2'], props['cloud-3'], props['cloud-4']],
        signpost: props.signpost,
        lamp: props.lamp,
        cottage: props.cottage,
      };
    });
  }
  return kitPromise;
}
