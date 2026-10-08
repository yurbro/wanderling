import type { WeatherCondition } from './types';

/**
 * When to ask for the phone's motion sensors (decisions section 9, ruling 7).
 * Never on the first day. After that, the first time it is snowing where the
 * person is, or the leaves are coming down where they live, while the app is
 * open: one light question. A "no" is final.
 */

const DAY_MS = 86_400_000;

/** Leaf-fall: October and November in the north, April and May in the south. */
export function isLeafFall(now: Date, lat: number): boolean {
  const m = now.getMonth();
  return lat >= 0 ? m === 9 || m === 10 : m === 3 || m === 4;
}

export interface AskContext {
  now: number;
  /** When the person first opened the app (the introduction finished). */
  startedAt: number | null;
  visible: boolean;
  lat: number;
  condition: WeatherCondition | null;
  /** Whether the question has been answered, either way, or the phone needs no permission. */
  settled: boolean;
}

export function shouldAskMotion(c: AskContext): boolean {
  if (c.settled || !c.visible || c.startedAt === null) return false;
  if (c.now - c.startedAt < DAY_MS) return false;
  const snowing = c.condition === 'snow' || c.condition === 'heavy-snow';
  return snowing || isLeafFall(new Date(c.now), c.lat);
}
