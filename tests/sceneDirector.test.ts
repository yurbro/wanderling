import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../src/core/color';
import { skyAt } from '../src/core/palette';
import { direct } from '../src/core/sceneDirector';
import { advance, locate, startJourney } from '../src/core/journey';
import { demoWeather } from '../src/core/weather';
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

describe('direct with weather', () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const midnight = new Date(Date.UTC(2026, 0, 15, 0, 30, 0));
  const lum = (c: number): number => {
    const { r, g, b } = hexToRgb(c);
    return r + g + b;
  };

  it('draws nothing weather-related when the weather is unknown', () => {
    const rs = direct(buildWorldState(noon, LONDON, null));
    expect(rs.weather.cloud).toBe(0);
    expect(rs.weather.rain).toBe(0);
    expect(rs.weather.snow).toBe(0);
    expect(rs.weather.fog).toBe(0);
    expect(rs.sun.alpha).toBe(1);
    expect(rs.sky).toEqual(skyAt(buildWorldState(noon, LONDON).sun.altitude));
  });

  it('greys and dims an overcast noon but keeps the ink dark', () => {
    const clear = direct(buildWorldState(noon, LONDON, null));
    const grey = direct(buildWorldState(noon, LONDON, demoWeather('overcast', noon)));
    expect(lum(grey.sky.horizon)).toBeLessThan(lum(clear.sky.horizon));
    expect(grey.light).toBeLessThan(clear.light);
    expect(grey.darkInk).toBe(true);
    expect(grey.weather.cloud).toBeGreaterThanOrEqual(0.85);
    expect(grey.sun.alpha).toBeLessThan(0.2);
  });

  it('hides the stars and veils the moon under a cloudy night', () => {
    const clear = direct(buildWorldState(midnight, LONDON, null));
    const cloudy = direct(buildWorldState(midnight, LONDON, demoWeather('overcast', midnight)));
    expect(clear.starAlpha).toBe(1);
    expect(cloudy.starAlpha).toBeLessThan(0.05);
    expect(cloudy.moon.alpha).toBeLessThan(clear.moon.alpha);
    expect(cloudy.darkInk).toBe(false);
  });

  it('rain wets the ground and sets the rain layer', () => {
    const dry = direct(buildWorldState(noon, LONDON, null));
    const wet = direct(buildWorldState(noon, LONDON, demoWeather('heavy-rain', noon)));
    expect(wet.weather.rain).toBeGreaterThan(0.5);
    expect(lum(wet.ground)).toBeLessThan(lum(dry.ground));
    expect(wet.weather.lightning).toBe(0);
    const storm = direct(buildWorldState(noon, LONDON, demoWeather('thunderstorm', noon)));
    expect(storm.weather.lightning).toBe(1);
  });

  it('fog pulls the far hills towards the fog color', () => {
    const clear = direct(buildWorldState(noon, LONDON, null));
    const foggy = direct(buildWorldState(noon, LONDON, demoWeather('fog', noon)));
    const dist = (a: number, b: number): number => {
      const x = hexToRgb(a);
      const y = hexToRgb(b);
      return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b);
    };
    expect(foggy.weather.fog).toBeGreaterThan(0.7);
    expect(dist(foggy.hills.far, foggy.weather.fogColor)).toBeLessThan(dist(clear.hills.far, foggy.weather.fogColor));
    expect(dist(foggy.hills.far, foggy.weather.fogColor)).toBeLessThan(dist(foggy.hills.near, foggy.weather.fogColor));
  });

  it('snow whitens the ground only when it is cold', () => {
    const base = direct(buildWorldState(noon, LONDON, null));
    const cold = direct(buildWorldState(noon, LONDON, demoWeather('heavy-snow', noon, { temperature: -1 })));
    const warm = direct(buildWorldState(noon, LONDON, demoWeather('heavy-snow', noon, { temperature: 8 })));
    expect(cold.weather.snow).toBeGreaterThan(0.6);
    expect(lum(cold.ground)).toBeGreaterThan(lum(base.ground));
    expect(lum(warm.ground)).toBeLessThanOrEqual(lum(base.ground) + 1);
  });

  it('wind direction becomes a screen drift', () => {
    const west = direct(buildWorldState(noon, LONDON, demoWeather('partly-cloudy', noon, { windDirection: 270, windSpeed: 30 })));
    const east = direct(buildWorldState(noon, LONDON, demoWeather('partly-cloudy', noon, { windDirection: 90, windSpeed: 30 })));
    expect(west.weather.wind).toBeLessThan(0);
    expect(east.weather.wind).toBeGreaterThan(0);
  });

  it('tells dawn from dusk', () => {
    // Sun at about 2 degrees: morning around 06:20 UTC, evening around 18:20 UTC on 4 Oct.
    const morning = direct(buildWorldState(new Date(Date.UTC(2026, 9, 4, 6, 20, 0)), LONDON));
    const evening = direct(buildWorldState(new Date(Date.UTC(2026, 9, 4, 17, 50, 0)), LONDON));
    expect(morning.phase).toBe('dawn');
    expect(evening.phase).toBe('dusk');
  });
});

describe('direct decides what the wanderer carries', () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const midnight = new Date(Date.UTC(2026, 0, 15, 0, 30, 0));

  it('opens the umbrella in rain and drizzle only', () => {
    expect(direct(buildWorldState(noon, LONDON, demoWeather('rain', noon))).wanderer.umbrella).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('drizzle', noon))).wanderer.umbrella).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('overcast', noon))).wanderer.umbrella).toBe(false);
    expect(direct(buildWorldState(noon, LONDON, null)).wanderer.umbrella).toBe(false);
  });

  it('lights the lantern at night, not at noon', () => {
    const night = direct(buildWorldState(midnight, LONDON, null)).wanderer;
    const day = direct(buildWorldState(noon, LONDON, null)).wanderer;
    expect(night.lantern).toBe(true);
    expect(night.lanternGlow).toBeGreaterThan(0.9);
    expect(day.lantern).toBe(false);
    expect(day.lanternGlow).toBe(0);
  });

  it('wears a scarf when it is cold or snowing', () => {
    expect(direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: 4 }))).wanderer.scarf).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('snow', noon, { temperature: 1 }))).wanderer.scarf).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: 22 }))).wanderer.scarf).toBe(false);
    expect(direct(buildWorldState(noon, LONDON, null)).wanderer.scarf).toBe(false);
  });

  it('tints the figure darker at night', () => {
    const night = hexToRgb(direct(buildWorldState(midnight, LONDON, null)).wanderer.tint);
    const day = hexToRgb(direct(buildWorldState(noon, LONDON, null)).wanderer.tint);
    expect(night.r + night.g + night.b).toBeLessThan(day.r + day.g + day.b);
    expect(day.r + day.g + day.b).toBeGreaterThan(740);
  });
});

describe('direct follows the journey', () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const route = {
    id: 'r',
    name: 'r',
    places: [
      { id: 'a', name: 'A', terrain: 'city' as const },
      { id: 'b', name: 'B', terrain: 'coast' as const },
      { id: 'c', name: 'C', terrain: 'hills' as const },
    ],
    legs: [
      { km: 8, terrain: 'plain' as const },
      { km: 10, terrain: 'hills' as const },
    ],
  };
  const t0 = noon.getTime();

  it('shows generic hills and keeps walking without a journey', () => {
    const rs = direct(buildWorldState(noon, LONDON, null, null));
    expect(rs.land.relief).toBe(1);
    expect(rs.land.sea).toBe(0);
    expect(rs.wanderer.pace).toBe(1);
    expect(rs.signpostKm).toBeNull();
  });

  it('flattens the land on a plain and puts the signpost behind just after leaving', () => {
    const s = advance(route, startJourney(route, t0), t0 + 0.25 * 3_600_000).state;
    const rs = direct(buildWorldState(noon, LONDON, null, locate(route, s, t0 + 0.25 * 3_600_000)));
    expect(rs.land.relief).toBeLessThan(0.7);
    expect(rs.wanderer.pace).toBe(1);
    expect(rs.signpostKm).toBeCloseTo(-1, 6);
  });

  it('stands still while resting, with the sea in view at the coast', () => {
    const s = advance(route, startJourney(route, t0), t0 + 3 * 3_600_000).state;
    const pos = locate(route, s, t0 + 3 * 3_600_000);
    expect(pos.resting).toBe(true);
    const rs = direct(buildWorldState(noon, LONDON, null, pos));
    expect(rs.wanderer.pace).toBe(0);
    expect(rs.signpostKm).toBe(0);
    expect(rs.land.sea).toBe(1);
  });
});
