import { clamp01, hexToRgb, mix, smoothstep } from './color';
import { CELESTIAL, LAND, WEATHER_TONES, skyAt } from './palette';
import type { CelestialPlacement, DayPhase, LegMode, PlaceMarker, RenderState, Terrain, WorldState } from './types';
import { TERRAIN, landAt } from './journey';
import { NO_WEATHER, weatherIntensities } from './weather';

/**
 * The SceneDirector is a pure function: WorldState in, RenderState out.
 * Nothing here touches the DOM or PixiJS, so it runs in unit tests as-is.
 *
 * The sun sets the clear-sky colors; the weather then greys, dims and veils
 * them. Both happen here so the renderer only ever draws numbers.
 */
export function direct(ws: WorldState): RenderState {
  const alt = ws.sun.altitude;
  const clearSky = skyAt(alt);

  // Daylight: full by the time the sun is 8 degrees up, floor of 0.22 at night.
  const dayLight = 0.22 + 0.78 * smoothstep(-8, 8, alt);
  const night = 1 - dayLight;

  // Aboard a plane the wanderer is above the weather: the sky is clear up there.
  const travelMode: LegMode =
    ws.journey && !ws.journey.resting && !ws.journey.finished ? ws.journey.mode : 'walk';
  const measured = weatherIntensities(ws.weather);
  const fx = travelMode === 'fly' ? { ...NO_WEATHER, wind: measured.wind } : measured;
  // How grey the day feels. Clouds do most of it, rain and fog add a little.
  const gloom = clamp01(fx.cloud * 0.9 + fx.rain * 0.25 + fx.snow * 0.1 + fx.fog * 0.3);

  // Sky: slide the clear-sky gradient towards a flat grey as the gloom grows,
  // and towards a darker slate when it is actually raining.
  const storm = clamp01(fx.rain * 0.8 + fx.snow * 0.3 + fx.lightning * 0.3);
  const greyTop = mix(
    mix(WEATHER_TONES.greyNightTop, WEATHER_TONES.greyDayTop, dayLight),
    mix(WEATHER_TONES.greyNightTop, WEATHER_TONES.stormDayTop, dayLight),
    storm,
  );
  const greyHorizon = mix(
    mix(WEATHER_TONES.greyNightHorizon, WEATHER_TONES.greyDayHorizon, dayLight),
    mix(WEATHER_TONES.greyNightHorizon, WEATHER_TONES.stormDayHorizon, dayLight),
    storm,
  );
  const top = mix(clearSky.top, greyTop, gloom);
  const horizon = mix(clearSky.horizon, greyHorizon, gloom);
  const sky = { top, mid: mix(top, horizon, 0.55), horizon };

  const light = dayLight * (1 - 0.25 * gloom);
  const clearStars = 1 - smoothstep(-12, -3, alt);
  const starAlpha = clearStars * (1 - smoothstep(0.15, 0.9, fx.cloud)) * (1 - fx.fog);

  // Clouds and fog veil the sun and moon; a full overcast hides them outright.
  const veil = clamp01(1 - smoothstep(0.2, 0.85, fx.cloud) - fx.fog * 0.8);
  const sun = place(ws.sun.altitude, ws.sun.azimuth);
  const moon = place(ws.moon.altitude, ws.moon.azimuth);
  // The moon only shows once the sky is dark enough for stars.
  const moonAlpha = clearStars > 0.02 ? Math.min(1, 0.25 + clearStars) * veil : 0;

  // Land: night tint first, then a touch of grey, then fog by depth, then snow.
  const tint = LAND.nightTint;
  // Land goes towards a grey of about its own brightness: duller, not lighter.
  const grey = mix(WEATHER_TONES.greyNightTop, WEATHER_TONES.landGreyDay, dayLight);
  const fogColor = mix(mix(WEATHER_TONES.fogNight, WEATHER_TONES.fogDay, dayLight), horizon, 0.35);
  const snowy = fx.snow > 0 && (ws.weather?.temperature ?? 0) <= 2 ? smoothstep(0, 0.6, fx.snow) : 0;
  const snowWhite = mix(WEATHER_TONES.snowNight, WEATHER_TONES.snowDay, dayLight);

  const land = (base: number | string, nightK: number, greyK: number, fogK: number, snowK: number): number => {
    let c = mix(base, tint, night * nightK);
    c = mix(c, grey, gloom * greyK);
    c = mix(c, fogColor, fx.fog * fogK);
    c = mix(c, snowWhite, snowy * snowK);
    return c;
  };

  const hills = {
    far: land(mix(LAND.hillFar, sky.horizon, 0.45), 0.9, 0.3, 0.92, 0.2),
    mid: land(mix(LAND.hillMid, sky.horizon, 0.2), 0.92, 0.3, 0.6, 0.3),
    near: land(LAND.hillNear, 0.94, 0.3, 0.3, 0.4),
  };
  let ground = land(LAND.ground, 0.9, 0.3, 0.2, 0.6);
  let path = land(LAND.path, 0.85, 0.25, 0.2, 0.5);
  // Rain darkens the earth.
  ground = mix(ground, WEATHER_TONES.wetGround, fx.rain * 0.4 * (1 - snowy));
  path = mix(path, WEATHER_TONES.wetGround, fx.rain * 0.3 * (1 - snowy));

  // Clouds: paper white by day, a little lighter than the sky by night,
  // greyer in bad weather and blushed by a low sun.
  const warmth = 1 - smoothstep(0, 15, alt);
  let cloudColor = mix(WEATHER_TONES.cloudNight, WEATHER_TONES.cloudDay, Math.pow(dayLight, 1.3));
  cloudColor = mix(cloudColor, sky.horizon, 0.18);
  cloudColor = mix(cloudColor, mix(WEATHER_TONES.cloudGreyNight, WEATHER_TONES.cloudGreyDay, dayLight), gloom * 0.7);
  cloudColor = mix(cloudColor, clearSky.horizon, warmth * (1 - gloom) * 0.35 * (alt > -6 ? 1 : 0));

  const dropColor = mix(sky.mid, WEATHER_TONES.paper, 0.45);

  // The wanderling: a leaf held up when it rains, a lantern once the sun is
  // well down, the scarf wrapped tight below freezing, a lean into a strong
  // wind, and the same night tint as the land.
  const temperature = ws.weather?.temperature;
  const journey = ws.journey;
  const wanderer = {
    // No leaf umbrella indoors: the train and plane windows keep the rain off.
    umbrella: fx.rain > 0.05 && travelMode === 'walk',
    lantern: alt < -4,
    lanternGlow: 1 - smoothstep(-10, -2, alt),
    cold: (temperature !== undefined && temperature < 0) || fx.snow > 0,
    windLean: windLean(ws.weather?.windSpeed ?? 0),
    // Standing still while resting, once the route is walked, or aboard a train or plane.
    pace: journey && (journey.resting || journey.finished || journey.mode !== 'walk') ? 0 : 1,
    // The figure takes less of the night and the grey than the land, so the cream
    // body and the red scarf stay readable (session 22).
    tint: mix(mix('#FFFFFF', tint, night * 0.4), WEATHER_TONES.landGreyDay, gloom * 0.06),
  };

  // The land: shaped by the terrain of the current leg, flat sea at the coast.
  const profile = journey ? landAt(journey.route, journey) : TERRAIN.hills;
  const landLayers = {
    relief: profile.relief,
    sea: profile.sea,
    seaColor: mix(mix(LAND.seaNight, LAND.seaDay, dayLight), horizon, 0.3),
    seaNear: mix(mix(LAND.seaNearNight, LAND.seaNearDay, dayLight), horizon, 0.12),
  };

  // The nearest place's marker: behind us just after leaving, ahead when close.
  let marker: PlaceMarker | null = null;
  if (journey && (journey.mode === 'walk' || journey.resting || journey.finished)) {
    const behind = journey.resting || journey.finished || journey.kmIntoLeg <= journey.kmToNext;
    const place = behind || !journey.to ? journey.from : journey.to;
    const offsetKm = journey.resting || journey.finished ? 0 : behind ? -journey.kmIntoLeg : journey.kmToNext;
    marker = { offsetKm, cottage: TOWNS.has(place.terrain) };
  }

  return {
    phase: phaseOf(alt, ws.sun.azimuth),
    sky,
    light,
    starAlpha,
    sun: { ...sun, warmth, alpha: veil },
    moon: { ...moon, phase: ws.moon.phase, fraction: ws.moon.fraction, alpha: moonAlpha },
    hills,
    ground,
    path,
    weather: {
      condition: ws.weather?.condition ?? 'clear',
      cloud: fx.cloud,
      fog: fx.fog,
      rain: fx.rain,
      snow: fx.snow,
      wind: fx.wind,
      lightning: fx.lightning,
      cloudColor,
      fogColor,
      dropColor,
    },
    wanderer,
    land: landLayers,
    travel: { mode: travelMode },
    marker,
    darkInk: luminance(sky.top) > 0.55,
  };
}

/**
 * How much the wanderling leans into the wind, 0..1. Nothing up to a breeze of
 * 20 km/h, fully braced from about 40 km/h; the design calls a wind over
 * roughly 30 km/h a headwind.
 */
export function windLean(speedKmh: number): number {
  return smoothstep(20, 40, speedKmh);
}

/** Terrains where a place is a town: it gets a lamp and a cottage. */
const TOWNS = new Set<Terrain>(['city', 'plain', 'coast', 'lake']);

/** Perceived brightness 0..1 of a color. */
export function luminance(color: number): number {
  const { r, g, b } = hexToRgb(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function phaseOf(alt: number, azimuth: number): DayPhase {
  if (alt < -8) return 'night';
  if (alt < 6) return azimuth > 180 ? 'dusk' : 'dawn';
  return 'day';
}

/**
 * Map altitude/azimuth to a spot on the sky rectangle.
 * We look roughly south (northern hemisphere habit), so east is on the left.
 */
function place(altitude: number, azimuth: number): CelestialPlacement {
  const az = (azimuth * Math.PI) / 180;
  const x = clamp01(0.5 - 0.42 * Math.sin(az));
  const y = clamp01(1 - altitude / 75);
  return { visible: altitude > -3, x, y };
}

export const SUN_COLORS = CELESTIAL;
