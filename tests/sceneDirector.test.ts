import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../src/core/color';
import { skyAt } from '../src/core/palette';
import { LEAF_PAINT, LEAF_SEASONS, direct, isSleepingHour, leafSeasonColor, leafSeasonTint, windLean } from '../src/core/sceneDirector';
import { routeFromHome } from '../src/core/geo';
import { KM_PER_HOUR, NEVER_ASLEEP, advance, locate, startJourney } from '../src/core/journey';
import { TO_THE_SEA } from '../src/data/routes';
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

  it('thins the clouds at night and keeps them solid by day and in a storm', () => {
    const day = direct(buildWorldState(noon, LONDON, demoWeather('partly-cloudy', noon))).weather.cloudAlpha;
    const night = direct(buildWorldState(midnight, LONDON, demoWeather('partly-cloudy', midnight))).weather.cloudAlpha;
    const stormy = direct(buildWorldState(midnight, LONDON, demoWeather('thunderstorm', midnight))).weather.cloudAlpha;
    expect(day).toBeGreaterThan(0.9);
    expect(night).toBeLessThan(0.65);
    expect(stormy).toBeGreaterThan(night);
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

  it('wraps the scarf tight below freezing or in snow', () => {
    expect(direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: -3 }))).wanderer.cold).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('snow', noon, { temperature: 1 }))).wanderer.cold).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: 4 }))).wanderer.cold).toBe(false);
    expect(direct(buildWorldState(noon, LONDON, null)).wanderer.cold).toBe(false);
  });

  it('leans into a strong wind and not into a breeze', () => {
    expect(windLean(0)).toBe(0);
    expect(windLean(15)).toBe(0);
    expect(windLean(30)).toBeCloseTo(0.5, 2);
    expect(windLean(45)).toBe(1);
    expect(direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { windSpeed: 50 }))).wanderer.windLean).toBe(1);
    expect(direct(buildWorldState(noon, LONDON, null)).wanderer.windLean).toBe(0);
    // Aboard a plane the wind still blows outside, but the lean is a walking posture.
    const rs = direct(buildWorldState(noon, LONDON, demoWeather('thunderstorm', noon)));
    expect(rs.wanderer.windLean).toBeGreaterThan(0.5);
  });

  it('sleeps from 2 to 4 by the local clock, standing still', () => {
    expect(isSleepingHour(new Date(2026, 9, 6, 1, 59))).toBe(false);
    expect(isSleepingHour(new Date(2026, 9, 6, 2, 0))).toBe(true);
    expect(isSleepingHour(new Date(2026, 9, 6, 3, 30))).toBe(true);
    expect(isSleepingHour(new Date(2026, 9, 6, 4, 0))).toBe(false);
    const three = new Date(2026, 9, 6, 3, 0);
    const rs = direct(buildWorldState(three, LONDON, null));
    expect(rs.wanderer.asleep).toBe(true);
    expect(rs.wanderer.pace).toBe(0);
    expect(direct(buildWorldState(noon, LONDON, null)).wanderer.asleep).toBe(false);
  });

  it('shows the surprises: a rainbow opposite the sun, a seat for the moon, a flurry for the snow globe', () => {
    const plain = direct(buildWorldState(noon, LONDON, null));
    expect(plain.surprise.rainbow).toBe(0);
    expect(plain.surprise.snowGlobe).toBe(0);
    const ws = { ...buildWorldState(noon, LONDON, null), surprises: { rainbow: 0.8, moonWatch: true, snowGlobe: 0.6 } };
    const rs = direct(ws);
    expect(rs.surprise.rainbow).toBeCloseTo(0.8);
    expect(rs.surprise.rainbowX).toBeCloseTo(1 - rs.sun.x);
    expect(rs.wanderer.pace).toBe(0);
    expect(rs.weather.snow).toBeCloseTo(0.6);
    // No rainbow at night.
    const night = { ...buildWorldState(new Date(2026, 9, 6, 23, 0), LONDON, null), surprises: { rainbow: 1, moonWatch: false, snowGlobe: 0 } };
    expect(direct(night).surprise.rainbow).toBe(0);
  });

  it('lets the leaf answer rain, sun, cold and heat', () => {
    const dry = direct(buildWorldState(noon, LONDON, demoWeather('clear', noon))).wanderer.leaf;
    expect(dry.droop).toBeCloseTo(0, 5);
    expect(dry.stiff).toBe(0);
    // Noon in London: the sun is to the south, near the middle, a touch west.
    expect(Math.abs(dry.toSun)).toBeLessThan(0.3);
    const wet = direct(buildWorldState(noon, LONDON, demoWeather('rain', noon))).wanderer.leaf;
    // The big leaf is up as an umbrella in the rain, so the small one stays dry.
    expect(wet.droop).toBeCloseTo(0, 5);
    const wetAboard = direct(buildWorldState(noon, LONDON, demoWeather('rain', noon), null)).wanderer.leaf;
    void wetAboard;
    const hot = direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: 36 }))).wanderer.leaf;
    expect(hot.droop).toBeGreaterThan(0.4);
    const cold = direct(buildWorldState(noon, LONDON, demoWeather('clear', noon, { temperature: -5 }))).wanderer.leaf;
    expect(cold.stiff).toBe(1);
    const night = direct(buildWorldState(midnight, LONDON, null)).wanderer.leaf;
    expect(night.droop).toBeCloseTo(0.2, 5);
    expect(night.toSun).toBe(0);
    // Morning: the sun is in the east, which is the left of the screen.
    const morning = new Date(Date.UTC(2026, 5, 21, 7, 30, 0));
    expect(direct(buildWorldState(morning, LONDON, null)).wanderer.leaf.toSun).toBeLessThan(-0.3);
  });

  it('colours the leaf by season and hemisphere', () => {
    const white = 0xffffff;
    // Mid-July in the north: the painted summer green, so no tint.
    expect(leafSeasonTint(new Date(Date.UTC(2026, 6, 20)), 51)).toBe(white);
    // Mid-October in the north: a greyed ochre, so red is held back least and blue most.
    const autumn = hexToRgb(leafSeasonTint(new Date(Date.UTC(2026, 9, 20)), 51));
    expect(autumn.r).toBeGreaterThan(autumn.g);
    expect(autumn.g).toBeGreaterThan(autumn.b);
    expect(autumn.b).toBeLessThan(230);
    // The same date in the south is spring: fresher green, blue a little back, red a little back.
    const spring = hexToRgb(leafSeasonTint(new Date(Date.UTC(2026, 9, 20)), -33));
    expect(spring.g).toBe(255);
    expect(spring.r).toBeLessThan(255);
    // Smooth: a day apart changes little.
    const a = hexToRgb(leafSeasonTint(new Date(Date.UTC(2026, 8, 1)), 51));
    const b = hexToRgb(leafSeasonTint(new Date(Date.UTC(2026, 8, 2)), 51));
    expect(Math.abs(a.b - b.b)).toBeLessThan(4);
  });

  it('never lets a season out-colour the grey-green leaf (review 3, ruling 2)', () => {
    // HSV saturation, 0..1.
    const sat = (c: number): number => {
      const { r, g, b } = hexToRgb(c);
      const max = Math.max(r, g, b);
      return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    };
    const hex = (h: string): number => parseInt(h.slice(1), 16);
    const ceiling = Math.max(sat(hex(LEAF_SEASONS.spring)), sat(hex(LEAF_SEASONS.summer)));
    // Every few days of the year, both hemispheres.
    for (let d = 0; d < 365; d += 3) {
      const when = new Date(Date.UTC(2026, 0, 1 + d));
      for (const lat of [51, -33]) expect(sat(leafSeasonColor(when, lat)), `${when.toISOString()} ${lat}`).toBeLessThanOrEqual(ceiling + 0.005);
    }
    // Autumn is an ochre, greyed: red over green over blue, and well under the ceiling.
    const autumnColor = leafSeasonColor(new Date(Date.UTC(2026, 9, 20)), 51);
    const autumn = hexToRgb(autumnColor);
    expect(autumn.r).toBeGreaterThan(autumn.g);
    expect(autumn.g).toBeGreaterThan(autumn.b);
    expect(sat(autumnColor)).toBeLessThan(ceiling * 0.7);
    // Winter is greyer than summer.
    expect(sat(leafSeasonColor(new Date(Date.UTC(2026, 0, 20)), 51))).toBeLessThan(sat(hex(LEAF_SEASONS.summer)));
    // The tint never asks a channel to be brighter than the paint.
    for (const c of Object.values(LEAF_SEASONS)) {
      const want = hexToRgb(hex(c));
      const paint = hexToRgb(hex(LEAF_PAINT));
      expect(want.r <= paint.r && want.g <= paint.g && want.b <= paint.b, c).toBe(true);
    }
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
    expect(rs.marker).toBeNull();
  });

  it('flattens the land on a plain and puts the signpost behind just after leaving', () => {
    const s = advance(route, startJourney(route, t0), t0 + 0.25 * 3_600_000).state;
    const rs = direct(buildWorldState(noon, LONDON, null, locate(route, s, t0 + 0.25 * 3_600_000)));
    expect(rs.land.relief).toBeLessThan(0.7);
    expect(rs.wanderer.pace).toBe(1);
    expect(rs.marker?.offsetKm).toBeCloseTo(-0.25 * KM_PER_HOUR, 6);
    expect(rs.marker?.cottage).toBe(true);
  });

  it("names the terrain to paint: the place's at either end of a leg, the leg's between", () => {
    const start = locate(route, startJourney(route, t0), t0);
    expect(direct(buildWorldState(noon, LONDON, null, start)).land.terrain).toBe(route.places[0].terrain);
    const legKm = route.legs[0].km;
    const mid = advance(route, startJourney(route, t0), t0 + ((legKm * 0.5) / KM_PER_HOUR) * 3_600_000).state;
    expect(direct(buildWorldState(noon, LONDON, null, locate(route, mid, t0 + ((legKm * 0.5) / KM_PER_HOUR) * 3_600_000))).land.terrain).toBe(route.legs[0].terrain);
    const near = advance(route, startJourney(route, t0), t0 + ((legKm * 0.9) / KM_PER_HOUR) * 3_600_000).state;
    expect(direct(buildWorldState(noon, LONDON, null, locate(route, near, t0 + ((legKm * 0.9) / KM_PER_HOUR) * 3_600_000))).land.terrain).toBe(route.places[1].terrain);
    expect(direct(buildWorldState(noon, LONDON, null)).land.terrain).toBe('hills');
  });

  it('stands still while resting, with the sea in view at the coast', () => {
    const t1 = t0 + (8 / KM_PER_HOUR + 1) * 3_600_000;
    const s = advance(route, startJourney(route, t0), t1).state;
    const pos = locate(route, s, t1);
    expect(pos.resting).toBe(true);
    const rs = direct(buildWorldState(noon, LONDON, null, pos));
    expect(rs.wanderer.pace).toBe(0);
    expect(rs.marker?.offsetKm).toBe(0);
    expect(rs.marker?.cottage).toBe(true);
    expect(rs.land.sea).toBe(1);
    expect(rs.land.seaNear).not.toBe(rs.land.seaColor);
  });

  it('marks the next place ahead, without a cottage on a hill', () => {
    const hilly = { ...route, places: [route.places[0], { id: 'h', name: 'H', terrain: 'hills' as const }, route.places[2]] };
    const s = advance(hilly, startJourney(hilly, t0), t0 + (6 / KM_PER_HOUR) * 3_600_000).state;
    const rs = direct(buildWorldState(noon, LONDON, null, locate(hilly, s, t0 + (6 / KM_PER_HOUR) * 3_600_000)));
    expect(rs.marker?.offsetKm).toBeCloseTo(2, 6);
    expect(rs.marker?.cottage).toBe(false);
  });
});

describe('the next place on the horizon (review 3, ruling 4)', () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const t0 = noon.getTime();
  const route = {
    id: 'r',
    name: 'R',
    places: [
      { id: 'a', name: 'A', terrain: 'plain' as const },
      { id: 'b', name: 'B', terrain: 'city' as const },
      { id: 'c', name: 'C', terrain: 'coast' as const },
    ],
    legs: [
      { km: 8, terrain: 'plain' as const },
      { km: 10, terrain: 'hills' as const },
    ],
  };
  const at = (kmWalked: number) => {
    const t = t0 + (kmWalked / KM_PER_HOUR) * 3_600_000;
    return direct(buildWorldState(noon, LONDON, null, locate(route, advance(route, startJourney(route, t0), t, NEVER_ASLEEP).state, t)));
  };

  it('is hidden while the HUD still counts kilometres', () => {
    const rs = at(6.5);
    expect(rs.landmark.alpha).toBe(0);
    expect(rs.landmark.closeness).toBe(0);
  });

  it('rises with "almost there" and grows as he gets closer', () => {
    const first = at(7.1);
    const half = at(7.5);
    const close = at(7.95);
    expect(first.landmark.terrain).toBe('city');
    expect(first.landmark.alpha).toBeGreaterThan(0.9);
    expect(first.landmark.closeness).toBeCloseTo(0.1, 3);
    expect(half.landmark.closeness).toBeCloseTo(0.5, 3);
    expect(close.landmark.closeness).toBeGreaterThan(half.landmark.closeness);
    // Before the signpost: the marker is still well ahead while the silhouette is already up.
    expect(first.marker?.offsetKm).toBeGreaterThan(0.8);
  });

  it('fades where it stands once he has arrived', () => {
    const rs = at(8 + KM_PER_HOUR * 0.5);
    expect(rs.landmark.closeness).toBe(1);
    expect(rs.landmark.alpha).toBe(0);
    expect(rs.landmark.terrain).toBe('city');
  });

  it('is not shown from a train', () => {
    const train = routeFromHome(TO_THE_SEA, { name: 'Berlin', lat: 52.52, lon: 13.4 });
    const near = t0 + ((train.legs[0].km - 5) / 60) * 3_600_000;
    const pos = locate(train, advance(train, startJourney(train, t0), near).state, near);
    expect(pos.mode).toBe('ride');
    expect(direct(buildWorldState(noon, LONDON, null, pos)).landmark.alpha).toBe(0);
  });
});

describe('direct aboard trains and planes', () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const t0 = noon.getTime();

  it('clears the weather above the clouds and stands the wanderer still in a plane', () => {
    const flown = routeFromHome(TO_THE_SEA, { name: 'Tokyo', lat: 35.68, lon: 139.69 });
    const pos = locate(flown, advance(flown, startJourney(flown, t0), t0 + 3_600_000).state, t0 + 3_600_000);
    expect(pos.mode).toBe('fly');
    const rs = direct(buildWorldState(noon, LONDON, demoWeather('heavy-rain', noon), pos));
    expect(rs.travel.mode).toBe('fly');
    expect(rs.weather.rain).toBe(0);
    expect(rs.weather.cloud).toBe(0);
    expect(rs.weather.fog).toBe(0);
    expect(rs.wanderer.pace).toBe(0);
    expect(rs.marker).toBeNull();
    // The sky itself is the clear one.
    expect(rs.sky).toEqual(direct(buildWorldState(noon, LONDON, null, null)).sky);
  });

  it('keeps the weather on a train and marks the travel as a ride', () => {
    const train = routeFromHome(TO_THE_SEA, { name: 'Berlin', lat: 52.52, lon: 13.4 });
    const pos = locate(train, advance(train, startJourney(train, t0), t0 + 3_600_000).state, t0 + 3_600_000);
    expect(pos.mode).toBe('ride');
    const rs = direct(buildWorldState(noon, LONDON, demoWeather('rain', noon), pos));
    expect(rs.travel.mode).toBe('ride');
    expect(rs.weather.rain).toBeGreaterThan(0);
    expect(rs.wanderer.pace).toBe(0);
  });

  it('is on foot while resting, even on a flight segment', () => {
    const flown = routeFromHome(TO_THE_SEA, { name: 'Tokyo', lat: 35.68, lon: 139.69 });
    const landed = t0 + (flown.legs[0].km / 700 + 0.5) * 3_600_000;
    const pos = locate(flown, advance(flown, startJourney(flown, t0), landed).state, landed);
    expect(pos.resting).toBe(true);
    expect(direct(buildWorldState(noon, LONDON, null, pos)).travel.mode).toBe('walk');
  });
});
