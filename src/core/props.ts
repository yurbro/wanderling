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
