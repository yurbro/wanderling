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
  /** Country or region, e.g. "United Kingdom". */
  region?: string;
}

/** Where a journey set out from: the person's own city at the time. */
export interface Home {
  name: string;
  region?: string;
  lat: number;
  lon: number;
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

/* ------------------------------------------------------------------------ */
/* The journey: a route of places joined by legs, walked in journey km.      */
/* ------------------------------------------------------------------------ */

/** What the land looks like around a place or along a leg. */
export type Terrain = 'city' | 'plain' | 'hills' | 'mountain' | 'forest' | 'coast' | 'lake' | 'desert';

export interface Place {
  id: string;
  name: string;
  /** Country, county or region, for the HUD. */
  region?: string;
  terrain: Terrain;
  /** Coarse coordinates, for a future map; never used for the sky. */
  lat?: number;
  lon?: number;
  /** One short line the wanderer might say on arriving. */
  note?: string;
}

export interface Leg {
  /** Real-world distance in kilometres. */
  km: number;
  terrain: Terrain;
}

export interface Route {
  id: string;
  name: string;
  /** Ordered places; legs[i] joins places[i] to places[i + 1]. */
  places: Place[];
  legs: Leg[];
}

export interface Arrival {
  placeId: string;
  /** Milliseconds since the epoch. */
  at: number;
}

/** Everything that needs saving to continue a journey later. */
export interface JourneyState {
  routeId: string;
  startedAt: number;
  /** Journey kilometres walked so far, as of updatedAt. */
  km: number;
  updatedAt: number;
  /** Set while the wanderer rests at a place; walking resumes afterwards. */
  restingUntil: number | null;
  arrivals: Arrival[];
  /** Kilometres added by real-world activity (steps, focus time), for later. */
  bonusKm: number;
  /** The city this journey started from, when it was known; the route is rebuilt from it. */
  home?: Home | null;
}

/** Where the wanderer is on the route right now, derived from JourneyState. */
export interface Position {
  route: Route;
  /** The last place reached. */
  from: Place;
  /** The place being walked towards, null once the route is done. */
  to: Place | null;
  legIndex: number;
  kmIntoLeg: number;
  kmToNext: number;
  /** 0 at `from`, 1 at `to`. */
  fraction: number;
  resting: boolean;
  finished: boolean;
  /** Journey km from the start. */
  km: number;
  totalKm: number;
}

/**
 * A postcard the wanderer sends on reaching a place. Everything needed to
 * draw it is captured at creation, so the album never has to recompute the
 * sky of a moment long gone.
 */
export interface Postcard {
  /** `${routeId}:${placeId}:${at}`, unique per journey. */
  id: string;
  routeId: string;
  placeId: string;
  placeName: string;
  region?: string;
  terrain: Terrain;
  /** Arrival time, milliseconds since the epoch. */
  at: number;
  /** The wanderer's line. */
  note: string;
  /** Weather at the moment of arrival, when known. */
  weather: { condition: WeatherCondition; code: number; temperature: number } | null;
  /** Scene colors at arrival, 0xRRGGBB, for the card's little landscape. */
  colors: { skyTop: number; skyHorizon: number; hillFar: number; hillNear: number; ground: number; sea: number };
  /** True when the sky was pale enough for dark ink. */
  darkInk: boolean;
  /** 0..1, how much of the horizon was water. */
  seaAmount: number;
}

export interface WorldState {
  now: Date;
  location: GeoPoint;
  sun: SunState;
  moon: MoonState;
  /** Null when nothing is known: the sky is then drawn clear. */
  weather: WeatherState | null;
  /** Null before a journey exists; the scene then shows generic hills. */
  journey: Position | null;
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

/** What the little traveler carries and wears right now. */
export interface WandererState {
  umbrella: boolean;
  lantern: boolean;
  /** 0..1 strength of the lantern's glow (grows as the night deepens). */
  lanternGlow: number;
  scarf: boolean;
  /** Walking pace multiplier, 0 stands still. */
  pace: number;
  /** Multiplicative tint for the whole figure: white by day, bluish by night. */
  tint: number;
}

/** How the land is shaped where the wanderer is. */
export interface LandLayers {
  /** Multiplier on hill height: flat plains below 1, mountains above. */
  relief: number;
  /** 0..1 how much of the far layer is water instead of hills. */
  sea: number;
  seaColor: number;
  /** The nearer water, a shade deeper. */
  seaNear: number;
}

/** The nearest place's marker: a signpost, and in towns a lamp and a cottage. */
export interface PlaceMarker {
  /** Offset from the wanderer in journey km, negative is behind. */
  offsetKm: number;
  cottage: boolean;
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
  wanderer: WandererState;
  land: LandLayers;
  /** Null when no journey is under way. */
  marker: PlaceMarker | null;
  /** True when the HUD text should be dark ink instead of pale paper. */
  darkInk: boolean;
}
