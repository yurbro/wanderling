import { describe, expect, it } from 'vitest';
import { dayKey } from '../src/core/letters';
import { eveningOf, fullMoonEvening, fullMoonEvenings, fullMoons, skyEvents, skyLetters } from '../src/core/skyCalendar';
import { EMPTY_LOG, begin, type SurpriseLog } from '../src/core/surprises';
import { skyLetterPool } from '../src/data/letterTexts';

const H = 3_600_000;
const DAY = 24 * H;
const POOLS = {
  moonSeen: skyLetterPool('moonSeen'),
  moonHidden: skyLetterPool('moonHidden'),
  meteors: skyLetterPool('meteors'),
  longest: skyLetterPool('longest'),
  shortest: skyLetterPool('shortest'),
  equinox: skyLetterPool('equinox'),
};

describe('the astronomical calendar', () => {
  it('finds the full moons, one a month, to within hours of the almanac', () => {
    const moons = fullMoons(Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 31));
    expect(moons.length).toBeGreaterThanOrEqual(12);
    expect(moons.length).toBeLessThanOrEqual(13);
    // 26 October 2026, 04:12 UTC; 24 November 2026, 14:53 UTC.
    expect(moons.some((m) => Math.abs(m - Date.UTC(2026, 9, 26, 4, 12)) < 6 * H)).toBe(true);
    expect(moons.some((m) => Math.abs(m - Date.UTC(2026, 10, 24, 14, 53)) < 6 * H)).toBe(true);
  });

  it('gives each full moon its evening, and the small hours belong to the night before', () => {
    const local = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime();
    expect(fullMoonEvening(local(26, 3))).toBe('2026-10-25');
    expect(fullMoonEvening(local(26, 20))).toBe('2026-10-26');
    expect(eveningOf(local(26, 0))).toBe('2026-10-25');
    expect(eveningOf(local(26, 22))).toBe('2026-10-26');
    expect(fullMoonEvenings(local(25, 12)).size).toBe(1);
  });

  it('knows the falling stars and the turning days, by hemisphere', () => {
    const year = (lat: number) => skyEvents(new Date(2026, 0, 2).getTime(), new Date(2026, 11, 30).getTime(), lat);
    const north = year(51);
    const south = year(-37);
    expect(north.find((e) => e.id === 'sky:meteors:perseids:2026')!.day).toBe('2026-08-12');
    expect(south.some((e) => e.id.includes('perseids'))).toBe(false);
    expect(north.find((e) => e.id === 'sky:solstice:2026-06')!.kind).toBe('longest');
    expect(south.find((e) => e.id === 'sky:solstice:2026-06')!.kind).toBe('shortest');
    expect(north.filter((e) => e.kind === 'equinox')).toHaveLength(2);
  });
});

describe('sky letters', () => {
  // The full moon of 26 October 2026 falls in the small hours in Europe: its evening is the 25th.
  const evening = new Date(2026, 9, 25, 22, 0).getTime();
  const day = eveningOf(evening);
  const nextMorning = new Date(2026, 9, 26, 10, 0).getTime();
  const since = new Date(2026, 9, 1).getTime();
  const moonLetter = (log: SurpriseLog, now = nextMorning) =>
    skyLetters(log, now, since, 51.5, POOLS).filter((c) => c.id.startsWith('sky:fullMoon'));

  it('say "I think you saw it too" the next morning when the person watched with him', () => {
    expect(fullMoonEvening(fullMoons(evening - 3 * DAY, evening + 3 * DAY)[0])).toBe(day);
    const log = begin(EMPTY_LOG, 'fullMoon', evening, true);
    const [c] = moonLetter(log);
    expect(c).toMatchObject({ kind: 'sky', pool: POOLS.moonSeen });
    expect(dayKey(c.wantAt)).toBe('2026-10-26');
    expect(new Date(c.wantAt).getHours()).toBe(9);
  });

  it('leave an unseen full moon to the missed letter, so there is only ever one', () => {
    const log: SurpriseLog = { events: begin(EMPTY_LOG, 'fullMoon', evening, true).events.map((e) => ({ ...e, witnessed: false })) };
    expect(moonLetter(log)).toEqual([]);
  });

  it('say it was there all the same when it never showed, but only once the night is over', () => {
    expect(moonLetter(EMPTY_LOG, new Date(2026, 9, 25, 23, 0).getTime())).toEqual([]);
    expect(moonLetter(EMPTY_LOG)[0].pool).toEqual(POOLS.moonHidden);
  });

  it('write nothing about skies before the journey, or long gone', () => {
    expect(skyLetters(EMPTY_LOG, nextMorning, nextMorning, 51.5, POOLS)).toEqual([]);
    expect(moonLetter(EMPTY_LOG, nextMorning + 5 * DAY)).toEqual([]);
  });

  it('mark the falling stars the morning after, and the longest day on the day', () => {
    const orionids = skyLetters(EMPTY_LOG, new Date(2026, 9, 22, 12).getTime(), since, 51.5, POOLS).find((c) => c.id.includes('orionids'))!;
    expect(dayKey(orionids.wantAt)).toBe('2026-10-22');
    const june = skyLetters(EMPTY_LOG, new Date(2026, 5, 21, 10).getTime(), new Date(2026, 5, 1).getTime(), -33.9, POOLS).find((c) => c.id.includes('solstice'))!;
    expect(june.pool).toEqual(POOLS.shortest);
  });
});
