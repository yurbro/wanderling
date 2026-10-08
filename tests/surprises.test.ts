import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOG,
  RULES,
  activeEvent,
  begin,
  intensity,
  mayStart,
  missedLetters,
  offer,
  rainEndedAgo,
  roll,
  ruleById,
  scanPast,
  type Facts,
  type SurpriseLog,
} from '../src/core/surprises';
import { missedSkeletons } from '../src/data/letterTexts';
import { shakeDetector } from '../src/data/motion';

const MIN = 60_000;
const H = 60 * MIN;
const T0 = new Date(2026, 9, 7, 16, 0, 0).getTime();

const calm: Facts = {
  at: T0,
  hour: 16,
  sunAltitude: 25,
  moonAltitude: -20,
  moonFraction: 0.3,
  rain: 0,
  cloud: 0.3,
  rainEndedAgo: null,
  walking: true,
};

/** An hour in which the rainbow's roll comes up, so the test does not depend on luck. */
function luckyHour(id: string, from: number, chance: number): number {
  for (let t = from; t < from + 200 * H; t += H) if (roll(id, t) < chance) return t;
  throw new Error('no lucky hour');
}

describe('the rules', () => {
  it('cover the first batch, and every world surprise that can be missed has letter text', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual(['asleep', 'cat', 'fullMoon', 'rainbow', 'snowGlobe', 'wave']);
    const ids = new Set(missedSkeletons().map((s) => s.id));
    for (const r of RULES) {
      if (r.source === 'person') expect(r.missed).toBeNull();
      else for (const sk of r.missed!) expect(ids.has(sk), `${r.id} → ${sk}`).toBe(true);
    }
  });

  it('bring a rainbow only when the rain has just stopped and the sun is low', () => {
    const rainbow = ruleById('rainbow').trigger!;
    expect(rainbow({ ...calm, rainEndedAgo: 20 * MIN })).toBe(true);
    expect(rainbow({ ...calm, rainEndedAgo: 20 * MIN, rain: 0.4 })).toBe(false);
    expect(rainbow({ ...calm, rainEndedAgo: 3 * H })).toBe(false);
    expect(rainbow({ ...calm, rainEndedAgo: 20 * MIN, sunAltitude: 60 })).toBe(false);
    expect(rainbow({ ...calm, rainEndedAgo: 20 * MIN, sunAltitude: -2 })).toBe(false);
    expect(rainbow({ ...calm, rainEndedAgo: 20 * MIN, walking: false })).toBe(false);
  });

  it('bring a full moon in the evening when it is round and the sky is open', () => {
    const moon = ruleById('fullMoon').trigger!;
    const night = { ...calm, hour: 22, sunAltitude: -30, moonAltitude: 30, moonFraction: 0.99 };
    expect(moon(night)).toBe(true);
    expect(moon({ ...night, moonFraction: 0.8 })).toBe(false);
    expect(moon({ ...night, hour: 14 })).toBe(false);
    expect(moon({ ...night, cloud: 0.9 })).toBe(false);
  });
});

describe('offer', () => {
  it('is steady: the same hour always rolls the same way', () => {
    expect(roll('rainbow', T0)).toBe(roll('rainbow', T0 + 10 * MIN));
    expect(roll('rainbow', T0)).toBeGreaterThanOrEqual(0);
    expect(roll('rainbow', T0)).toBeLessThan(1);
  });

  it('starts a rainbow when the world allows and the roll comes up, and marks it seen when the person is there', () => {
    const at = luckyHour('rainbow', T0, ruleById('rainbow').chance);
    const f = { ...calm, at, rainEndedAgo: 10 * MIN };
    const unseen = offer(EMPTY_LOG, f, false);
    expect(activeEvent(unseen, 'rainbow', at)?.witnessed).toBe(false);
    const seen = offer(unseen, { ...f, at: at + MIN }, true);
    expect(activeEvent(seen, 'rainbow', at + MIN)?.witnessed).toBe(true);
    // Nothing to do: the same log comes back.
    expect(offer(seen, { ...f, at: at + 2 * MIN }, true)).toBe(seen);
  });

  it('keeps a cooldown: no second rainbow for two days', () => {
    const at = luckyHour('rainbow', T0, ruleById('rainbow').chance);
    const f = { ...calm, at, rainEndedAgo: 10 * MIN };
    const log = offer(EMPTY_LOG, f, true);
    const later = luckyHour('rainbow', at + H, ruleById('rainbow').chance);
    expect(mayStart(log, ruleById('rainbow'), later)).toBe(later - at >= 2 * 24 * H);
    expect(mayStart(log, ruleById('rainbow'), at + 3 * 24 * H)).toBe(true);
  });

  it('fades in and out', () => {
    const log = begin(EMPTY_LOG, 'rainbow', T0, true);
    expect(intensity(log, 'rainbow', T0)).toBe(0);
    expect(intensity(log, 'rainbow', T0 + 22_500)).toBeCloseTo(0.5);
    expect(intensity(log, 'rainbow', T0 + 5 * MIN)).toBe(1);
    expect(intensity(log, 'rainbow', T0 + 12 * MIN - 22_500)).toBeCloseTo(0.5);
    expect(intensity(log, 'rainbow', T0 + 13 * MIN)).toBe(0);
  });

  it('lets the person start the snow globe, but not twice in a breath', () => {
    const log = begin(EMPTY_LOG, 'snowGlobe', T0);
    expect(activeEvent(log, 'snowGlobe', T0 + 1000)).toBeTruthy();
    expect(begin(log, 'snowGlobe', T0 + 5000)).toBe(log);
    expect(begin(log, 'snowGlobe', T0 + 30_000)).not.toBe(log);
  });
});

describe('missed letters', () => {
  it('writes about what went unseen, once, and nothing about what the person watched', () => {
    let log: SurpriseLog = begin(EMPTY_LOG, 'rainbow', T0 - 2 * H, true);
    log = { events: log.events.map((e) => ({ ...e, witnessed: false })) };
    log = begin(log, 'fullMoon', T0 - 3 * H, true); // witnessed
    const first = missedLetters(log, T0);
    expect(first.candidates.map((c) => c.kind)).toEqual(['missed']);
    expect(first.candidates[0].pool).toEqual(ruleById('rainbow').missed);
    expect(first.candidates[0].wantAt).toBe(T0 - 2 * H + ruleById('rainbow').durationMs);
    const again = missedLetters(first.log, T0 + H);
    expect(again.candidates).toEqual([]);
    expect(again.log).toBe(first.log);
  });

  it('says nothing while a surprise is still on', () => {
    let log = begin(EMPTY_LOG, 'fullMoon', T0, true);
    log = { events: log.events.map((e) => ({ ...e, witnessed: false })) };
    expect(missedLetters(log, T0 + 10 * MIN).candidates).toEqual([]);
  });

  it('writes about sleeping through the night only the first time', () => {
    const night = (d: number): number => new Date(2026, 9, 7 + d, 2, 0, 0).getTime();
    let log: SurpriseLog = EMPTY_LOG;
    const asleep = (at: number): Facts => ({ ...calm, at, hour: 2.5, sunAltitude: -40 });
    log = offer(log, asleep(night(0)), false);
    const one = missedLetters(log, night(0) + 5 * H);
    expect(one.candidates).toHaveLength(1);
    log = offer(one.log, asleep(night(1)), false);
    const two = missedLetters(log, night(1) + 5 * H);
    expect(two.candidates).toHaveLength(0);
  });

  it('finds a full moon that came and went while the app was closed', () => {
    const start = new Date(2026, 9, 7, 18, 0, 0).getTime();
    const factsAt = (at: number): Facts => {
      const hour = new Date(at).getHours() + new Date(at).getMinutes() / 60;
      return { ...calm, at, hour, sunAltitude: -30, moonAltitude: 40, moonFraction: 0.99 };
    };
    const log = scanPast(EMPTY_LOG, factsAt, start, start + 12 * H);
    const moon = log.events.find((e) => e.id === 'fullMoon')!;
    expect(moon).toBeTruthy();
    expect(new Date(moon.at).getHours()).toBe(20);
    expect(moon.witnessed).toBe(false);
    // The night's sleep at 2 am went by too, so two letters are owed.
    const ids = missedLetters(log, start + 12 * H).candidates.map((c) => c.id);
    expect(ids[0]).toBe(`missed:fullMoon:${moon.at}`);
    expect(ids[1]).toMatch(/^missed:asleep:/);
  });
});

describe('rainEndedAgo', () => {
  const hours = [
    { time: T0 - 3 * H, rain: 0.5 },
    { time: T0 - 2 * H, rain: 0.4 },
    { time: T0 - H, rain: 0 },
    { time: T0, rain: 0 },
  ];
  it('measures from the end of the last wet hour', () => {
    expect(rainEndedAgo(hours, T0 + 10 * MIN)).toBe(70 * MIN);
    expect(rainEndedAgo(hours, T0 - 90 * MIN)).toBe(0);
    expect(rainEndedAgo(hours, T0 + 7 * H)).toBeNull();
    expect(rainEndedAgo([], T0)).toBeNull();
  });
});

describe('shakeDetector', () => {
  it('needs two jolts close together, then rests', () => {
    let shakes = 0;
    let now = 0;
    const on = shakeDetector(() => shakes++, () => now);
    const g = (x: number) => ({ accelerationIncludingGravity: { x, y: 0, z: 9.8 } });
    on(g(0));
    now = 100; on(g(20));
    expect(shakes).toBe(0);
    now = 300; on(g(0));
    expect(shakes).toBe(1);
    // Straight after, nothing more.
    now = 500; on(g(20));
    now = 700; on(g(0));
    expect(shakes).toBe(1);
    // Two jolts too far apart do not count.
    now = 5000; on(g(20));
    now = 6000; on(g(0));
    expect(shakes).toBe(1);
  });
});

describe('the first week\'s day 2 (review v2: a small surprise for sure)', () => {
  const day2 = (hour: number, extra: Partial<Facts> = {}): Facts => ({ ...calm, at: new Date(2026, 9, 10, hour, 0).getTime(), hour, scriptDay: 2, ...extra });

  it('brings a cat as soon as the person is there, on foot, by day', () => {
    const log = offer(EMPTY_LOG, day2(11), true);
    expect(log.events.map((e) => [e.id, e.witnessed])).toEqual([['cat', true]]);
    expect(intensity(log, 'cat', day2(11).at + 10 * MIN)).toBe(1);
    // Not on other days, not at night, not aboard a train, not twice.
    expect(offer(EMPTY_LOG, { ...day2(11), scriptDay: 3 }, true).events).toEqual([]);
    expect(offer(EMPTY_LOG, { ...day2(11), scriptDay: null }, true).events).toEqual([]);
    expect(offer(EMPTY_LOG, day2(22), true).events).toEqual([]);
    expect(offer(EMPTY_LOG, day2(11, { walking: false }), true).events).toEqual([]);
    expect(offer(log, day2(18), true).events).toHaveLength(1);
  });

  it('comes unseen at four if nobody is there, and is written about', () => {
    expect(offer(EMPTY_LOG, day2(15), false).events).toEqual([]);
    const log = offer(EMPTY_LOG, day2(16), false);
    expect(log.events[0]).toMatchObject({ id: 'cat', witnessed: false });
    const { candidates } = missedLetters(log, day2(18).at);
    expect(candidates).toEqual([expect.objectContaining({ kind: 'missed', pool: ['x.cat1'] })]);
  });

  it('stays away on a day that already had a rainbow: that was the surprise', () => {
    const rainbow = begin(EMPTY_LOG, 'rainbow', day2(9).at, true);
    expect(offer(rainbow, day2(11), true).events.map((e) => e.id)).toEqual(['rainbow']);
  });
});

describe('the full moon follows the calendar (review 3, ruling 8)', () => {
  it('rises for the calendar\'s full-moon night, and not for a merely round moon', () => {
    const moon = ruleById('fullMoon').trigger!;
    const night = { ...calm, hour: 22, sunAltitude: -30, moonAltitude: 30, moonFraction: 0.98 };
    expect(moon({ ...night, fullMoonNight: true })).toBe(true);
    expect(moon({ ...night, fullMoonNight: false })).toBe(false);
    expect(moon({ ...night, fullMoonNight: true, moonAltitude: 2 })).toBe(false);
  });
});
