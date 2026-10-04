import { describe, expect, it } from 'vitest';
import { blendRenderState, easeInOut } from '../src/core/blend';
import { hexToRgb } from '../src/core/color';
import { direct } from '../src/core/sceneDirector';
import { demoWeather } from '../src/core/weather';
import { buildWorldState } from '../src/core/world';

const LONDON = { lat: 51.51, lon: -0.13, name: 'London' };
const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));

describe('blendRenderState', () => {
  const clear = direct(buildWorldState(noon, LONDON, null));
  const rain = direct(buildWorldState(noon, LONDON, demoWeather('heavy-rain', noon)));

  it('returns the ends at 0 and 1', () => {
    expect(blendRenderState(clear, rain, 0)).toBe(clear);
    expect(blendRenderState(clear, rain, 1)).toBe(rain);
  });

  it('mixes colours and slides intensities halfway', () => {
    const half = blendRenderState(clear, rain, 0.5);
    const lum = (c: number) => { const { r, g, b } = hexToRgb(c); return r + g + b; };
    expect(lum(half.sky.top)).toBeLessThan(lum(clear.sky.top));
    expect(lum(half.sky.top)).toBeGreaterThan(lum(rain.sky.top));
    expect(half.weather.rain).toBeCloseTo(rain.weather.rain / 2, 6);
    expect(half.weather.cloud).toBeCloseTo((clear.weather.cloud + rain.weather.cloud) / 2, 6);
    expect(half.light).toBeCloseTo((clear.light + rain.light) / 2, 6);
  });

  it('switches names, flags and modes at once and keeps the structure', () => {
    const half = blendRenderState(clear, rain, 0.3);
    expect(half.weather.condition).toBe('heavy-rain');
    expect(half.wanderer.umbrella).toBe(true);
    expect(half.wanderer.pace).toBe(rain.wanderer.pace);
    expect(half.travel.mode).toBe('walk');
    expect(half.darkInk).toBe(rain.darkInk);
    expect(Object.keys(half).sort()).toEqual(Object.keys(rain).sort());
    expect(half.marker).toBeNull();
  });

  it('eases in and out', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });
});
