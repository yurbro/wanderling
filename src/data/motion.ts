/**
 * A shake of the phone, for the snow globe. iOS only hands out motion events
 * after `DeviceMotionEvent.requestPermission()` is called from a tap, so the
 * first tap on the scene asks once; a refusal is remembered and never asked
 * again (design: refused means we simply do not do it).
 */

const KEY = 'wanderling.motion';
/** m/s² of change between two readings that counts as a jolt. */
const JOLT = 14;
/** Two jolts this close together make a shake. */
const WINDOW_MS = 700;

type Permission = 'granted' | 'denied' | 'unsupported';

interface MotionEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

let listening = false;

function remembered(): Permission | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function remember(p: Permission): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    // Fine.
  }
}

/** True when asking would show the person a prompt (iOS, not yet decided). */
export function needsMotionPrompt(): boolean {
  const ctor = (globalThis as { DeviceMotionEvent?: MotionEventCtor }).DeviceMotionEvent;
  return !!ctor?.requestPermission && remembered() === null;
}

/** Start listening for a shake; call from a user gesture the first time. */
export async function enableShake(onShake: () => void): Promise<Permission> {
  const ctor = (globalThis as { DeviceMotionEvent?: MotionEventCtor }).DeviceMotionEvent;
  if (!ctor) return 'unsupported';
  if (remembered() === 'denied') return 'denied';
  if (ctor.requestPermission && remembered() !== 'granted') {
    try {
      const r = await ctor.requestPermission();
      remember(r === 'granted' ? 'granted' : 'denied');
      if (r !== 'granted') return 'denied';
    } catch {
      // Not called from a gesture, or an old iOS: try again on the next tap.
      return 'denied';
    }
  }
  if (!listening) {
    listening = true;
    window.addEventListener('devicemotion', shakeDetector(onShake));
  }
  return 'granted';
}

/** Turns raw accelerations into a single `onShake` per shake. */
export function shakeDetector(onShake: () => void, now: () => number = () => Date.now()): (e: { accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null }) => void {
  let last: { x: number; y: number; z: number } | null = null;
  let firstJolt = 0;
  let cooledAt = 0;
  return (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const cur = { x: a.x, y: a.y, z: a.z };
    if (last) {
      const d = Math.hypot(cur.x - last.x, cur.y - last.y, cur.z - last.z);
      const t = now();
      if (d > JOLT && t > cooledAt) {
        if (firstJolt && t - firstJolt < WINDOW_MS) {
          firstJolt = 0;
          cooledAt = t + 1_500;
          onShake();
        } else {
          firstJolt = t;
        }
      }
    }
    last = cur;
  };
}
