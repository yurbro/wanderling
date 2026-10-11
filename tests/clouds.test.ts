import { describe, expect, it } from 'vitest';
import { HUD_CLOUD_FLOOR, hudCloudFade } from '../src/core/clouds';

describe('hudCloudFade', () => {
  it('fades a cloud under the clock and leaves the rest of the sky alone', () => {
    expect(hudCloudFade(0.2, 0.1)).toBeCloseTo(HUD_CLOUD_FLOOR, 5);
    expect(hudCloudFade(0.9, 0.1)).toBe(1);
    expect(hudCloudFade(0.2, 0.5)).toBe(1);
  });

  it('eases out across the edge of the text block instead of stepping', () => {
    const inside = hudCloudFade(0.5, 0.1);
    const edge = hudCloudFade(0.63, 0.1);
    const outside = hudCloudFade(0.8, 0.1);
    expect(inside).toBeLessThan(edge);
    expect(edge).toBeLessThan(outside);
  });
});
