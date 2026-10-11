import type { Terrain } from './types';

/**
 * How many of one kind of roadside prop may stand on the screen at once
 * (decisions section 9, rulings 13 and 17): a town had three or four benches
 * in view. Two at most of anything, and the one muted-red postbox only once,
 * so the scarf stays the loudest thing there.
 */

export const MAX_SAME_PROP = 2;
export const PROP_LIMITS: Record<string, number> = { postbox: 1 };

export function propLimit(name: string): number {
  return PROP_LIMITS[name] ?? MAX_SAME_PROP;
}

/**
 * One of `names` that still fits, given how many of each are in view, or null
 * when every kind is used up. `r` in [0, 1) picks among those that fit.
 */
export function pickProp(names: readonly string[], inView: Readonly<Record<string, number>>, r: number): string | null {
  const open = names.filter((n) => (inView[n] ?? 0) < propLimit(n));
  if (open.length === 0) return null;
  return open[Math.min(open.length - 1, Math.floor(r * open.length))];
}

/**
 * What stands by the road in each kind of country, as the odds of each sort
 * of roadside thing (quality pass Q6): a desert is stones and the odd cactus,
 * a plain is grass with haystacks, a forest has mushrooms and stumps under
 * the tufts, a town has little of any of it. The four odds sum to 1.
 */
export type DetailKind = 'extra' | 'tuft' | 'stone' | 'flower';
export const DETAIL_MIX: Record<Terrain, Record<DetailKind, number>> = {
  hills: { extra: 0.0, tuft: 0.5, stone: 0.22, flower: 0.28 },
  plain: { extra: 0.24, tuft: 0.46, stone: 0.08, flower: 0.22 },
  mountain: { extra: 0.22, tuft: 0.3, stone: 0.42, flower: 0.06 },
  forest: { extra: 0.28, tuft: 0.4, stone: 0.1, flower: 0.22 },
  coast: { extra: 0.18, tuft: 0.4, stone: 0.34, flower: 0.08 },
  lake: { extra: 0.26, tuft: 0.48, stone: 0.1, flower: 0.16 },
  desert: { extra: 0.26, tuft: 0.16, stone: 0.52, flower: 0.06 },
  city: { extra: 0.14, tuft: 0.4, stone: 0.16, flower: 0.3 },
};

/** Which sort of roadside thing `r` in [0, 1) lands on, in this terrain. */
export function detailKind(terrain: Terrain, r: number): DetailKind {
  const mix = DETAIL_MIX[terrain];
  let acc = 0;
  for (const kind of ['extra', 'tuft', 'stone', 'flower'] as const) {
    acc += mix[kind];
    if (r < acc) return kind;
  }
  return 'flower';
}
