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
};

export const CELESTIAL = {
  sunDay: '#F8EBC0',
  sunLow: '#F3C48C',
  moon: '#ECE7D6',
  star: '#F6F1E3',
};
