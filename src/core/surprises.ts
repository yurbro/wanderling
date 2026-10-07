import type { Candidate } from './letters';

/**
 * The surprise engine: the small things that happen once in a while, written
 * as data rules (docs/design/decisions.md section 8): a trigger on the state
 * of the world, a chance, a cooldown, whether it happens once, and the letter
 * he writes when the person was not there to see it. Pure functions over
 * plain data; the renderer only reads `intensity()`.
 *
 * Two sources. The world brings some (a rainbow after the rain, a full moon,
 * sleep at 2 am): those can be missed, and a missed one becomes a letter.
 * The person brings the others (a long press for a wave, a shake for the
 * snow globe): those are never missed.
 */

export type SurpriseId = 'rainbow' | 'fullMoon' | 'asleep' | 'snowGlobe' | 'wave';

/** What the rules look at, at one moment. */
export interface Facts {
  /** Milliseconds since the epoch. */
  at: number;
  /** The person's local hour, fractional. */
  hour: number;
  /** Degrees above the horizon. */
  sunAltitude: number;
  moonAltitude: number;
  /** 0 new, 1 full. */
  moonFraction: number;
  /** 0..1 how hard it rains right now. */
  rain: number;
  /** 0..1 cloud cover. */
  cloud: number;
  /** Milliseconds since the rain stopped; null when it is raining or no rain is known. */
  rainEndedAgo: number | null;
  /** On foot, outdoors (not aboard a train or plane). */
  walking: boolean;
}

export interface SurpriseRule {
  id: SurpriseId;
  source: 'world' | 'person';
  /** World surprises: when the world allows it. */
  trigger?: (f: Facts) => boolean;
  /** Chance per hour of opportunity, 0..1. */
  chance: number;
  cooldownMs: number;
  durationMs: number;
  /** Seconds the picture takes to fade in and out. */
  fadeMs: number;
  /** Happens once ever. */
  once: boolean;
  /** Skeleton pool for the letter when the person was away; null never writes one. */
  missed: string[] | null;
  /** Only the first missed one is worth a letter (sleep happens every night). */
  missedOnce?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RULES: SurpriseRule[] = [
  {
    id: 'rainbow',
    source: 'world',
    // The rain has just stopped, the sun is up but low, and the sky has opened a little.
    trigger: (f) => f.walking && f.rain < 0.05 && f.rainEndedAgo !== null && f.rainEndedAgo <= 60 * MIN && f.sunAltitude > 2 && f.sunAltitude < 42 && f.cloud < 0.85,
    chance: 0.7,
    cooldownMs: 2 * DAY,
    durationMs: 12 * MIN,
    fadeMs: 45_000,
    once: false,
    missed: ['x.rainbow1', 'x.rainbow2'],
  },
  {
    id: 'fullMoon',
    source: 'world',
    // A full moon, well up, in the evening, with a sky clear enough to show it.
    trigger: (f) => f.moonFraction >= 0.97 && f.moonAltitude > 8 && (f.hour >= 20 || f.hour < 1) && f.cloud < 0.7,
    chance: 1,
    cooldownMs: 20 * DAY,
    durationMs: 90 * MIN,
    fadeMs: 30_000,
    once: false,
    missed: ['x.moon1', 'x.moon2'],
  },
  {
    id: 'asleep',
    source: 'world',
    trigger: (f) => f.hour >= 2 && f.hour < 4,
    chance: 1,
    cooldownMs: 20 * HOUR,
    durationMs: 2 * HOUR,
    fadeMs: 1_000,
    once: false,
    missed: ['x.sleep1'],
    missedOnce: true,
  },
  {
    id: 'snowGlobe',
    source: 'person',
    chance: 1,
    cooldownMs: 20_000,
    durationMs: 9_000,
    fadeMs: 1_500,
    once: false,
    missed: null,
  },
  {
    id: 'wave',
    source: 'person',
    chance: 1,
    cooldownMs: 0,
    durationMs: 2_600,
    fadeMs: 0,
    once: false,
    missed: null,
  },
];

export const ruleById = (id: SurpriseId): SurpriseRule => RULES.find((r) => r.id === id)!;

export interface SurpriseEvent {
  id: SurpriseId;
  /** When it began, milliseconds since the epoch. */
  at: number;
  until: number;
  /** The person had the app open while it was happening. */
  witnessed: boolean;
  /** A letter about it has been offered to the letter engine. */
  lettered?: boolean;
}

export interface SurpriseLog {
  events: SurpriseEvent[];
}

export const EMPTY_LOG: SurpriseLog = { events: [] };

const KEEP = 60;

/**
 * A steady roll for a rule and an hour, 0..1, so that scanning the past
 * agrees with what the live clock decided. A small string hash.
 */
export function roll(id: string, at: number): number {
  const s = `${id}:${Math.floor(at / HOUR)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function activeEvent(log: SurpriseLog, id: SurpriseId, now: number): SurpriseEvent | undefined {
  return log.events.find((e) => e.id === id && e.at <= now && now < e.until);
}

function lastOf(log: SurpriseLog, id: SurpriseId): SurpriseEvent | undefined {
  let best: SurpriseEvent | undefined;
  for (const e of log.events) if (e.id === id && (!best || e.at > best.at)) best = e;
  return best;
}

/** Whether a rule may start now: not running, past its cooldown, and not already spent. */
export function mayStart(log: SurpriseLog, rule: SurpriseRule, now: number): boolean {
  const last = lastOf(log, rule.id);
  if (!last) return true;
  if (rule.once) return false;
  if (now < last.until) return false;
  return now - last.at >= rule.cooldownMs;
}

function push(log: SurpriseLog, e: SurpriseEvent): SurpriseLog {
  const events = [...log.events, e];
  return { events: events.length > KEEP ? events.slice(events.length - KEEP) : events };
}

/**
 * Let the world have its say at one moment. `present` says whether the person
 * is looking: running events are then marked witnessed. Returns the same log
 * when nothing changed.
 */
export function offer(log: SurpriseLog, f: Facts, present: boolean): SurpriseLog {
  let out = log;
  for (const rule of RULES) {
    if (rule.source !== 'world' || !rule.trigger) continue;
    const running = activeEvent(out, rule.id, f.at);
    if (running) {
      if (present && !running.witnessed) {
        out = { events: out.events.map((e) => (e === running ? { ...e, witnessed: true } : e)) };
      }
      continue;
    }
    if (!rule.trigger(f) || !mayStart(out, rule, f.at)) continue;
    if (rule.chance < 1 && roll(rule.id, f.at) >= rule.chance) continue;
    out = push(out, { id: rule.id, at: f.at, until: f.at + rule.durationMs, witnessed: present });
  }
  return out;
}

/** Start a surprise now, by the person's hand or the demo. Same log when its cooldown holds. */
export function begin(log: SurpriseLog, id: SurpriseId, now: number, force = false): SurpriseLog {
  const rule = ruleById(id);
  if (!force && !mayStart(log, rule, now)) return log;
  return push(log, { id, at: now, until: now + rule.durationMs, witnessed: true });
}

/**
 * Walk the hours the app was closed, so a rainbow or a full moon that came and
 * went still counts, and can turn into a letter. `factsAt` rebuilds the world
 * for a past moment from the sky maths and the cached forecast.
 */
export function scanPast(log: SurpriseLog, factsAt: (at: number) => Facts | null, from: number, to: number, stepMs = 15 * MIN): SurpriseLog {
  let out = log;
  for (let t = from; t < to; t += stepMs) {
    const f = factsAt(t);
    if (f) out = offer(out, f, false);
  }
  return out;
}

/** How much of a surprise shows right now, 0..1, with its fade at both ends. */
export function intensity(log: SurpriseLog, id: SurpriseId, now: number): number {
  const e = activeEvent(log, id, now);
  if (!e) return 0;
  const fade = ruleById(id).fadeMs;
  if (fade <= 0) return 1;
  const inRamp = Math.min(1, (now - e.at) / fade);
  const outRamp = Math.min(1, (e.until - now) / fade);
  return Math.max(0, Math.min(inRamp, outRamp));
}

/**
 * The surprises that came and went unseen, as letter candidates, each offered
 * once. Returns the same log when there is nothing new.
 */
export function missedLetters(log: SurpriseLog, now: number): { log: SurpriseLog; candidates: Candidate[] } {
  const candidates: Candidate[] = [];
  let changed = false;
  const events = log.events.map((e) => {
    if (e.witnessed || e.lettered || now < e.until) return e;
    const rule = ruleById(e.id);
    changed = true;
    if (!rule.missed) return { ...e, lettered: true };
    const alreadyWritten = rule.missedOnce && log.events.some((o) => o.id === e.id && o.lettered && o !== e);
    if (!alreadyWritten) {
      candidates.push({ id: `missed:${e.id}:${e.at}`, kind: 'missed', wantAt: e.until, pool: rule.missed });
    }
    return { ...e, lettered: true };
  });
  return changed ? { log: { events }, candidates } : { log, candidates };
}

/** Milliseconds since rain last fell before `now`, from hourly samples; 0 while it rains, null when none is known within six hours. */
export function rainEndedAgo(samples: { time: number; rain: number }[], now: number): number | null {
  let lastRain: number | null = null;
  for (const s of samples) {
    if (s.time > now || s.rain < 0.05) continue;
    if (lastRain === null || s.time > lastRain) lastRain = s.time;
  }
  if (lastRain === null) return null;
  // A sample stands for its hour.
  const ended = lastRain + HOUR;
  if (now < ended) return 0;
  const ago = now - ended;
  return ago > 6 * HOUR ? null : ago;
}
