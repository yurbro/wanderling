import { mix } from './color';
import type { RenderState } from './types';

/**
 * Blend two RenderStates so the renderer can ease from one to the next
 * instead of jumping. Colours are mixed, other numbers interpolated, and
 * everything else (names, flags, modes) comes from the target at once.
 */

/** Keys whose numbers are 0xRRGGBB colours. */
const COLOR_KEYS = new Set([
  'top', 'mid', 'horizon', 'far', 'near', 'ground', 'path',
  'cloudColor', 'fogColor', 'dropColor', 'seaColor', 'seaNear', 'tint', 'silhouette',
]);

/** Keys that must switch at once rather than slide. */
const INSTANT_KEYS = new Set(['phase', 'fraction', 'pace', 'lightning', 'offsetKm', 'seed']);

function blendValue(key: string, a: unknown, b: unknown, t: number): unknown {
  if (INSTANT_KEYS.has(key)) return b;
  if (typeof a === 'number' && typeof b === 'number') {
    if (COLOR_KEYS.has(key)) return mix(a, b, t);
    return a + (b - a) * t;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) {
    const out: Record<string, unknown> = {};
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    for (const k of Object.keys(bo)) out[k] = k in ao ? blendValue(k, ao[k], bo[k], t) : bo[k];
    return out;
  }
  return b;
}

/** t = 0 gives `from`, t = 1 gives `to`. */
export function blendRenderState(from: RenderState, to: RenderState, t: number): RenderState {
  const k = Math.max(0, Math.min(1, t));
  if (k >= 1) return to;
  if (k <= 0) return from;
  return blendValue('', from, to, k) as RenderState;
}

/** Ease in and out, for a change that settles gently. */
export function easeInOut(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}
