import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../src/core/color';
import { skyAt } from '../src/core/palette';
import { direct } from '../src/core/sceneDirector';
import { buildWorldState } from '../src/core/world';

const LONDON = { lat: 51.51, lon: -0.13, name: 'London' };

describe('skyAt', () => {
  it('is dark at night and pale during the day', () => {
    const night = hexToRgb(skyAt(-30).top);
    const day = hexToRgb(skyAt(45).top);
    const lumNight = night.r + night.g + night.b;
    const lumDay = day.r + day.g + day.b;
    expect(lumNight).toBeLessThan(lumDay);
  });

  it('interpolates between keyframes', () => {
    const a = hexToRgb(skyAt(-2).horizon);
    const b = hexToRgb(skyAt(0).horizon);
    const mid = hexToRgb(skyAt(-1).horizon);
    for (const ch of ['r', 'g', 'b'] as const) {
      const lo = Math.min(a[ch], b[ch]);
      const hi = Math.max(a[ch], b[ch]);
      expect(mid[ch]).toBeGreaterThanOrEqual(lo - 1);
      expect(mid[ch]).toBeLessThanOrEqual(hi + 1);
    }
  });

  it('clamps outside the keyframe range', () => {
    expect(skyAt(-120)).toEqual(skyAt(-90));
    expect(skyAt(120)).toEqual(skyAt(90));
  });
});

describe('direct', () => {
  it('produces full daylight at a London summer noon', () => {
    const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const rs = direct(buildWorldState(noon, LONDON));
    expect(rs.phase).toBe('day');
    expect(rs.light).toBeGreaterThan(0.95);
    expect(rs.starAlpha).toBe(0);
    expect(rs.sun.visible).toBe(true);
    expect(rs.darkInk).toBe(true);
  });

  it('produces night at a London winter midnight', () => {
    const midnight = new Date(Date.UTC(2026, 0, 15, 0, 30, 0));
    const rs = direct(buildWorldState(midnight, LONDON));
    expect(rs.phase).toBe('night');
    expect(rs.light).toBeCloseTo(0.22, 2);
    expect(rs.starAlpha).toBe(1);
    expect(rs.sun.visible).toBe(false);
    expect(rs.darkInk).toBe(false);
  });

  it('darkens the land at night compared with the day', () => {
    const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const midnight = new Date(Date.UTC(2026, 0, 15, 0, 30, 0));
    const day = hexToRgb(direct(buildWorldState(noon, LONDON)).hills.near);
    const night = hexToRgb(direct(buildWorldState(midnight, LONDON)).hills.near);
    expect(night.r + night.g + night.b).toBeLessThan(day.r + day.g + day.b);
  });

  it('keeps celestial placements inside the sky rectangle', () => {
    for (let h = 0; h < 24; h++) {
      const d = new Date(Date.UTC(2026, 9, 4, h, 0, 0));
      const rs = direct(buildWorldState(d, LONDON));
      for (const c of [rs.sun, rs.moon]) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(1);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
