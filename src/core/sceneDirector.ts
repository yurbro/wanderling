import { clamp01, mix, smoothstep } from './color';
import { CELESTIAL, LAND, skyAt } from './palette';
import type { CelestialPlacement, DayPhase, RenderState, WorldState } from './types';

/**
 * The SceneDirector is a pure function: WorldState in, RenderState out.
 * Nothing here touches the DOM or PixiJS, so it runs in unit tests as-is.
 */
export function direct(ws: WorldState): RenderState {
  const alt = ws.sun.altitude;
  const sky = skyAt(alt);

  // Brightness: full by the time the sun is 8 degrees up, floor of 0.22 at night.
  const light = 0.22 + 0.78 * smoothstep(-8, 8, alt);
  const starAlpha = 1 - smoothstep(-12, -3, alt);
  const night = 1 - light;

  const sun = place(ws.sun.altitude, ws.sun.azimuth);
  const moon = place(ws.moon.altitude, ws.moon.azimuth);

  const tint = LAND.nightTint;
  const hills = {
    far: mix(mix(LAND.hillFar, sky.horizon, 0.45), tint, night * 0.9),
    mid: mix(mix(LAND.hillMid, sky.horizon, 0.2), tint, night * 0.92),
    near: mix(LAND.hillNear, tint, night * 0.94),
  };

  return {
    phase: phaseOf(alt),
    sky,
    light,
    starAlpha,
    sun: { ...sun, warmth: 1 - smoothstep(0, 15, alt) },
    moon: { ...moon, phase: ws.moon.phase, fraction: ws.moon.fraction },
    hills,
    ground: mix(LAND.ground, tint, night * 0.9),
    path: mix(LAND.path, tint, night * 0.85),
    darkInk: light > 0.72,
  };
}

function phaseOf(alt: number): DayPhase {
  if (alt < -8) return 'night';
  if (alt < 6) return 'dawn'; // refined into dusk by the caller when needed
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
