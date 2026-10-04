/**
 * Core data model.
 *
 * WorldState  = everything we know about the real world right now (pure data).
 * RenderState = what the scene should look like (pure data, derived by the SceneDirector).
 *
 * Keeping both as plain data makes the whole pipeline testable without a browser
 * and lets a demo mode fake any time of day.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Human readable label, e.g. "London". Optional until we reverse-geocode. */
  name?: string;
}

/** Angles in degrees. Azimuth is compass style: 0 = north, 90 = east, 180 = south. */
export interface SunState {
  altitude: number;
  azimuth: number;
}

export interface MoonState {
  altitude: number;
  azimuth: number;
  /** 0 = new moon, 0.5 = full moon, 1 = next new moon. */
  phase: number;
  /** Illuminated fraction 0..1. */
  fraction: number;
}

/**
 * The handful of weather looks the scene knows how to draw. The WMO weather
 * codes from the forecast API are folded into these in core/weather.ts.
 */
export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'heavy-snow';

/**
 * Where a WeatherState came from. 'current' is a recent observation,
 * 'forecast' is the hourly slot picked from an older fetch (offline fallback),
 * 'demo' is forced through the URL or the demo panel.
 */
export type WeatherSource = 'current' | 'forecast' | 'demo';

export interface WeatherState {
  condition: WeatherCondition;
  /** WMO weather interpretation code as reported by the API. */
  code: number;
  /** Cloud cover 0..1. */
  cloudCover: number;
  /** Air temperature in degrees Celsius. */
  temperature: number;
  /** Wind speed in km/h and the compass direction it blows from. */
  windSpeed: number;
  windDirection: number;
  /** Precipitation in millimetres for the hour. */
  precipitation: number;
  /** The moment this sample describes. */
  time: Date;
  source: WeatherSource;
}

export interface WorldState {
  now: Date;
  location: GeoPoint;
  sun: SunState;
  moon: MoonState;
  /** Null when nothing is known: the sky is then drawn clear. */
  weather: WeatherState | null;
}

/** Colors are 0xRRGGBB numbers so they can go straight into PixiJS. */
export interface SkyPalette {
  top: number;
  mid: number;
  horizon: number;
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

export interface CelestialPlacement {
  visible: boolean;
  /** Horizontal position across the sky, 0 = left edge, 1 = right edge. */
  x: number;
  /** Vertical position, 0 = top of the sky, 1 = at the horizon line. */
  y: number;
}

/** Everything the renderer needs to draw the weather, all pre-digested. */
export interface WeatherLayers {
  condition: WeatherCondition;
  /** 0..1 how many cloud shapes to show. */
  cloud: number;
  /** 0..1 fog density over the hills. */
  fog: number;
  /** 0..1 rain intensity (drop count and speed). */
  rain: number;
  /** 0..1 snow intensity. */
  snow: number;
  /** Horizontal drift -1..1, negative blows towards the left edge. */
  wind: number;
  /** 1 when lightning may flash, 0 otherwise. */
  lightning: number;
  cloudColor: number;
  fogColor: number;
  /** Rain streak color; snow is always paper white. */
  dropColor: number;
}

export interface RenderState {
  phase: DayPhase;
  sky: SkyPalette;
  /** Overall scene brightness 0..1, used to darken ground and hills. */
  light: number;
  /** 0 = no stars, 1 = full night sky. */
  starAlpha: number;
  sun: CelestialPlacement & { warmth: number; alpha: number };
  moon: CelestialPlacement & { phase: number; fraction: number; alpha: number };
  hills: { far: number; mid: number; near: number };
  ground: number;
  path: number;
  weather: WeatherLayers;
  /** True when the HUD text should be dark ink instead of pale paper. */
  darkInk: boolean;
}
