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

export interface WorldState {
  now: Date;
  location: GeoPoint;
  sun: SunState;
  moon: MoonState;
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

export interface RenderState {
  phase: DayPhase;
  sky: SkyPalette;
  /** Overall scene brightness 0..1, used to darken ground and hills. */
  light: number;
  /** 0 = no stars, 1 = full night sky. */
  starAlpha: number;
  sun: CelestialPlacement & { warmth: number };
  moon: CelestialPlacement & { phase: number; fraction: number };
  hills: { far: number; mid: number; near: number };
  ground: number;
  path: number;
  /** True when the HUD text should be dark ink instead of pale paper. */
  darkInk: boolean;
}
