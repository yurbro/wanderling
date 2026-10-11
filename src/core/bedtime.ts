import { mix, smoothstep } from './color';
import type { RenderState } from './types';

/**
 * Bedtime mode (decisions D9; review v2 N4). Opening the app late at night,
 * he sits by a campfire. The sky slowly darkens; ten minutes on he falls
 * asleep, the picture fades to black and everything stops. There is no
 * reward and nothing to collect: the point is to help someone put the phone
 * down. Pure rules; the picture lives in src/scene/campfire.ts and main.ts.
 */

/** Opening between these hours (the person's clock) starts it: 22:00 to 04:00. */
export const BEDTIME_FROM_HOUR = 22;
export const BEDTIME_UNTIL_HOUR = 4;
/** Ten minutes until he falls asleep. */
export const DIM_MS = 10 * 60_000;
/** Then half a minute to black. */
export const FADE_MS = 30_000;
/** The fire comes up in its first seconds. */
const FIRE_IN_MS = 15_000;
/** Coming back to the app after at least this long away counts as opening it again. */
export const REOPEN_AFTER_MS = 5 * 60_000;
/** The darkest the sky gets while he is still awake, and once asleep. */
const DIM_AWAKE = 0.62;
const DIM_ASLEEP = 0.8;
const NIGHT_BLUE = 0x070a14;

export function isBedtimeHour(now: Date): boolean {
  const h = now.getHours();
  return h >= BEDTIME_FROM_HOUR || h < BEDTIME_UNTIL_HOUR;
}

export interface BedtimeLook {
  /** 0..1 how far the sky and land have gone dark. */
  dim: number;
  /** 0..1 how high the fire burns (it sinks to embers once he sleeps). */
  fire: number;
  asleep: boolean;
  /** 0..1 how black the screen is; 1 means stop drawing. */
  fade: number;
  over: boolean;
}

/** What the scene looks like `elapsedMs` after bedtime mode began. */
export function bedtimeLook(elapsedMs: number): BedtimeLook {
  const e = Math.max(0, elapsedMs);
  const asleep = e >= DIM_MS;
  const toSleep = smoothstep(0, DIM_MS, e);
  const dim = asleep ? DIM_ASLEEP : DIM_AWAKE * toSleep;
  const fireUp = smoothstep(0, FIRE_IN_MS, e);
  const fire = asleep ? fireUp * 0.4 : fireUp;
  const fade = asleep ? smoothstep(0, FADE_MS, e - DIM_MS) : 0;
  return { dim, fire, asleep, fade, over: fade >= 1 };
}

/** The scene as bedtime sees it: darker, he sits by the fire, asleep once the time comes. */
export function applyBedtime(rs: RenderState, look: BedtimeLook): RenderState {
  const d = look.dim;
  const dark = (c: number): number => mix(c, NIGHT_BLUE, d);
  return {
    ...rs,
    sky: { top: dark(rs.sky.top), mid: dark(rs.sky.mid), horizon: dark(rs.sky.horizon) },
    hills: { far: dark(rs.hills.far), mid: dark(rs.hills.mid), near: dark(rs.hills.near) },
    ground: dark(rs.ground),
    path: dark(rs.path),
    light: rs.light * (1 - 0.6 * d),
    starAlpha: Math.max(rs.starAlpha, d * 0.9),
    darkInk: false,
    wanderer: { ...rs.wanderer, pace: 0, lantern: false, asleep: look.asleep || rs.wanderer.asleep },
    bedtime: { fire: look.fire },
  };
}
