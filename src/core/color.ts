/** Tiny color helpers. Colors travel as 0xRRGGBB numbers. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: number | string): RGB {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex(c: RGB): number {
  const r = clamp255(c.r);
  const g = clamp255(c.g);
  const b = clamp255(c.b);
  return (r << 16) | (g << 8) | b;
}

export function hexToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Linear blend between two colors, t = 0 gives a, t = 1 gives b. */
export function mix(a: number | string, b: number | string, t: number): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Smooth 0..1 ramp between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
