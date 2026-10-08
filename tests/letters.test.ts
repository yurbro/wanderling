import { describe, expect, it } from 'vitest';
import {
  EMPTY_MAIL,
  bundled,
  dayKey,
  deliver,
  fillSlots,
  markAllRead,
  momentTime,
  nextMorning,
  unreadCount,
  visibleLetters,
  type Candidate,
  type Mail,
} from '../src/core/letters';
import { momentsFor, weatherSkeletons } from '../src/data/letterTexts';

const H = 3_600_000;
// A local-time afternoon, so day boundaries do not depend on the runner's zone.
const T0 = new Date(2026, 9, 7, 15, 0, 0).getTime();

const moment = (id: string, at: number, pool = ['m.a', 'm.b', 'm.c']): Candidate => ({ id, kind: 'moment', wantAt: at, pool });
const postcard = (id: string, at: number): Candidate => ({ id, kind: 'postcard', wantAt: at, skeleton: `place:r:${id}`, vars: { place: id } });

describe('deliver', () => {
  it('seats at most two letters a day and pushes the rest to the next morning', () => {
    const mail = deliver(EMPTY_MAIL, [moment('m1', T0), moment('m2', T0 + H), moment('m3', T0 + 2 * H)], T0 + 3 * H);
    const days = mail.letters.map((l) => dayKey(l.at));
    expect(days.filter((d) => d === dayKey(T0))).toHaveLength(2);
    const pushed = mail.letters.find((l) => l.id === 'm3')!;
    expect(pushed.at).toBe(nextMorning(T0 + 2 * H));
    expect(new Date(pushed.at).getHours()).toBe(9);
    // It is not visible yet.
    expect(visibleLetters(mail, T0 + 3 * H).map((l) => l.id).sort()).toEqual(['m1', 'm2']);
  });

  it('lets only one of a postcard, sky letter or missed letter arrive on a day, postcard first', () => {
    const sky: Candidate = { id: 's1', kind: 'sky', wantAt: T0 - H, skeleton: 'sky.moon' };
    const mail = deliver(EMPTY_MAIL, [sky, postcard('p1', T0)], T0);
    const p = mail.letters.find((l) => l.id === 'p1')!;
    const s = mail.letters.find((l) => l.id === 's1')!;
    expect(dayKey(p.at)).toBe(dayKey(T0));
    expect(dayKey(s.at)).not.toBe(dayKey(T0));
    expect(s.at).toBe(nextMorning(T0 - H));
  });

  it('ignores candidates already in the box', () => {
    const once = deliver(EMPTY_MAIL, [moment('m1', T0)], T0);
    const twice = deliver(once, [moment('m1', T0), moment('m1', T0 + H)], T0 + H);
    expect(twice.letters).toHaveLength(1);
  });

  it('does not repeat a skeleton until every one in the pool has gone out', () => {
    let mail: Mail = EMPTY_MAIL;
    const picks: string[] = [];
    for (let i = 0; i < 5; i++) {
      const at = T0 + i * 48 * H;
      mail = deliver(mail, [moment(`m${i}`, at)], at);
      picks.push(mail.letters.find((l) => l.id === `m${i}`)!.skeleton);
    }
    expect(picks.slice(0, 3).sort()).toEqual(['m.a', 'm.b', 'm.c']);
    expect(new Set(picks.slice(0, 3)).size).toBe(3);
    // Round two starts again, still without an immediate repeat.
    expect(['m.a', 'm.b', 'm.c']).toContain(picks[3]);
    expect(picks[3]).not.toBe(picks[2]);
  });

  it('folds older unread letters into a digest once more than three sit unread', () => {
    let mail: Mail = EMPTY_MAIL;
    // Two a day over three days, none read.
    for (let d = 0; d < 3; d++) {
      const at = T0 + d * 24 * H;
      mail = deliver(mail, [moment(`a${d}`, at), moment(`b${d}`, at + H)], at + H);
    }
    const now = T0 + 3 * 24 * H;
    const shown = visibleLetters(mail, now);
    expect(unreadCount(mail, now)).toBe(3);
    const digest = shown.find((l) => l.kind === 'digest')!;
    expect(digest).toBeTruthy();
    expect(bundled(mail, digest).map((l) => l.id)).toEqual(['a0', 'b0', 'a1', 'b1']);
    expect(shown.filter((l) => l.kind !== 'digest').map((l) => l.id).sort()).toEqual(['a2', 'b2']);
    // Reading the box clears everything that has arrived.
    const read = markAllRead(mail, now);
    expect(unreadCount(read, now)).toBe(0);
    expect(read.letters.every((l) => l.read)).toBe(true);
  });

  it('fills slots and leaves unknown ones alone', () => {
    expect(fillSlots('I am in {place} now. {nope}', { place: 'Porto' })).toBe('I am in Porto now. {nope}');
  });

  it('picks a steady afternoon time for the day’s small thing', () => {
    const a = momentTime('2026-10-07');
    expect(momentTime('2026-10-07')).toBe(a);
    const h = new Date(a).getHours();
    expect(h).toBeGreaterThanOrEqual(10);
    expect(h).toBeLessThanOrEqual(18);
    expect(momentTime('2026-10-08')).not.toBe(a);
  });
});

describe('the texts', () => {
  it('offer something for every terrain, and a weather line for each outlook', () => {
    for (const terrain of ['city', 'plain', 'hills', 'mountain', 'forest', 'coast', 'lake', 'desert'] as const) {
      expect(momentsFor(terrain).length).toBeGreaterThanOrEqual(8);
    }
    for (const o of ['rain', 'snow', 'wind'] as const) expect(weatherSkeletons(o).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the first week\'s additions to the rules', () => {
  it('drops a same-day-only letter (tomorrow\'s weather) rather than pushing it to a morning when it is stale', () => {
    const weather: Candidate = { id: 'w', kind: 'weather', wantAt: T0 + 3 * H, pool: ['w.rain1'], sameDayOnly: true };
    const full = deliver(EMPTY_MAIL, [moment('m1', T0), moment('m2', T0 + H)], T0 + H);
    expect(deliver(full, [weather], T0 + 3 * H).letters.map((l) => l.id)).toEqual(['m1', 'm2']);
    expect(deliver(EMPTY_MAIL, [weather], T0 + 3 * H).letters.map((l) => l.id)).toEqual(['w']);
  });

  it('never folds a question or the week of sky into a digest', () => {
    const q: Candidate = { id: 'q', kind: 'question', wantAt: T0, skeleton: 'q.hat' };
    const wk: Candidate = { id: 'wk', kind: 'week', wantAt: T0 + 49 * H, skeleton: 'k.week' };
    let mail = deliver(EMPTY_MAIL, [q, wk], T0 + 50 * H);
    for (let i = 0; i < 5; i++) mail = deliver(mail, [moment(`m${i}`, T0 + (i + 1) * 24 * H)], T0 + 6 * 24 * H);
    const shown = visibleLetters(mail, T0 + 6 * 24 * H).map((l) => l.id);
    expect(shown).toContain('q');
    expect(shown).toContain('wk');
    expect(shown.some((id) => id.startsWith('digest'))).toBe(true);
  });

  it('remembers when a letter was first seen', () => {
    const mail = markAllRead(deliver(EMPTY_MAIL, [moment('m1', T0)], T0), T0 + H);
    expect(mail.letters[0].readAt).toBe(T0 + H);
    expect(markAllRead(mail, T0 + 5 * H).letters[0].readAt).toBe(T0 + H);
  });
});
