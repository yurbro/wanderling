import { mix } from './color';
import type { SkyPalette } from './types';

/**
 * Sky keyframes indexed by sun altitude (degrees above the horizon).
 * Muted, slightly desaturated colors on purpose: the look we are after is
 * hand-drawn paper, not a photograph.
 */
interface SkyKey {
  alt: number;
  top: string;
  horizon: string;
}

export const SKY_KEYS: SkyKey[] = [
  { alt: -90, top: '#1A1F3A', horizon: '#2C3254' },
  { alt: -18, top: '#1C2240', horizon: '#343B5E' },
  { alt: -12, top: '#222A4C', horizon: '#474C72' },
  { alt: -6, top: '#36406E', horizon: '#7F6D8F' },
  { alt: -2, top: '#5C6498', horizon: '#C78E8B' },
  { alt: 0, top: '#7F86B0', horizon: '#E6AA8E' },
  { alt: 4, top: '#9FAACB', horizon: '#F0CAA4' },
  { alt: 12, top: '#A9C4DD', horizon: '#EFE4D0' },
  { alt: 30, top: '#A6CBE3', horizon: '#E4EEF2' },
  { alt: 90, top: '#9CC5E2', horizon: '#E4EEF2' },
];

/** Interpolated sky colors for a given sun altitude. */
export function skyAt(altitude: number): SkyPalette {
  const keys = SKY_KEYS;
  if (altitude <= keys[0].alt) return toPalette(keys[0].top, keys[0].horizon);
  const last = keys[keys.length - 1];
  if (altitude >= last.alt) return toPalette(last.top, last.horizon);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (altitude >= a.alt && altitude <= b.alt) {
      const t = (altitude - a.alt) / (b.alt - a.alt);
      return toPalette(mix(a.top, b.top, t), mix(a.horizon, b.horizon, t));
    }
  }
  return toPalette(last.top, last.horizon);
}

function toPalette(top: number | string, horizon: number | string): SkyPalette {
  const t = typeof top === 'string' ? parseInt(top.slice(1), 16) : top;
  const h = typeof horizon === 'string' ? parseInt(horizon.slice(1), 16) : horizon;
  return { top: t, mid: mix(t, h, 0.55), horizon: h };
}

/** Daytime base colors for the land. Night darkening happens in the director. */
export const LAND = {
  hillFar: '#A7B8B4',
  hillMid: '#7E9A8C',
  hillNear: '#587868',
  ground: '#A4A684',
  path: '#D9CFAE',
  nightTint: '#262D4C',
  seaDay: '#7C9DB0',
  seaNight: '#2A3550',
  seaNearDay: '#6B8DA2',
  seaNearNight: '#242E48',
};

export const CELESTIAL = {
  sunDay: '#F8EBC0',
  sunLow: '#F3C48C',
  moon: '#ECE7D6',
  star: '#F6F1E3',
};

/**
 * Tones the weather pulls the scene towards. Kept grey and quiet on purpose:
 * a rainy day in the journal is soft pencil, not a storm poster.
 */
export const WEATHER_TONES = {
  greyDayTop: '#A4ABB2',
  greyDayHorizon: '#CBCFD1',
  stormDayTop: '#858D96',
  stormDayHorizon: '#B2B7BB',
  greyNightTop: '#232737',
  greyNightHorizon: '#2E3345',
  landGreyDay: '#8F938F',
  fogDay: '#D9DBD8',
  fogNight: '#2A2F40',
  cloudDay: '#F4EFE4',
  cloudNight: '#303652',
  cloudGreyDay: '#C3C7CB',
  cloudGreyNight: '#2A2E40',
  snowDay: '#E9E6DC',
  snowNight: '#4A5068',
  wetGround: '#6F7466',
  paper: '#F4EFE4',
};

/**
 * The traveler's wardrobe. One saturated focal color (the brick-red backpack),
 * everything else muted, outlines in warm dark grey rather than black.
 */
export const WANDERER = {
  ink: '#4A4A52',
  skin: '#EFD9C4',
  coat: '#6F7A8E',
  coatShade: '#5E6879',
  trousers: '#4F5566',
  boots: '#3E3E46',
  hat: '#A48A6A',
  hatBand: '#7C6650',
  backpack: '#B86B5A',
  backpackFlap: '#9E5A4B',
  scarf: '#4D5B8A',
  umbrella: '#4D5B8A',
  lanternGlass: '#F8EBC0',
  glow: '#F8EBC0',
};

/** Props that stand at a place, and the boats on the sea. */
export const PROPS = {
  wood: '#8C7355',
  board: '#D9CFAE',
  wall: '#E8DEC3',
  roof: '#9E7A6A',
  window: '#4A4A52',
  hull: '#5B5F6E',
  hullDark: '#4A4A52',
  sail: '#F4EFE4',
  funnel: '#B86B5A',
  train: '#5E7366',
  trainRoof: '#3E3E46',
  trim: '#E8DEC3',
  fuselage: '#4A5062',
};
