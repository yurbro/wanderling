import SunCalc from 'suncalc';
import type { MoonState, SunState } from './types';

const RAD = 180 / Math.PI;

/**
 * suncalc measures azimuth in radians from south, positive towards west.
 * Convert to compass degrees: 0 = north, 90 = east, 180 = south, 270 = west.
 */
function toCompass(azimuthFromSouth: number): number {
  const deg = azimuthFromSouth * RAD + 180;
  return ((deg % 360) + 360) % 360;
}

export function computeSun(now: Date, lat: number, lon: number): SunState {
  const p = SunCalc.getPosition(now, lat, lon);
  return { altitude: p.altitude * RAD, azimuth: toCompass(p.azimuth) };
}

export function computeMoon(now: Date, lat: number, lon: number): MoonState {
  const p = SunCalc.getMoonPosition(now, lat, lon);
  const illum = SunCalc.getMoonIllumination(now);
  return {
    altitude: p.altitude * RAD,
    azimuth: toCompass(p.azimuth),
    phase: illum.phase,
    fraction: illum.fraction,
  };
}

/** Sunrise and sunset for the day, handy for the HUD and later for the journal. */
export function sunTimes(now: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } {
  const t = SunCalc.getTimes(now, lat, lon);
  return { sunrise: t.sunrise, sunset: t.sunset };
}
