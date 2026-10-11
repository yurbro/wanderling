import { describe, expect, it } from 'vitest';
import { DIM_MS, FADE_MS, applyBedtime, bedtimeLook, isBedtimeHour } from '../src/core/bedtime';
import { direct } from '../src/core/sceneDirector';
import { buildWorldState } from '../src/core/world';

const MIN = 60_000;
const at = (h: number, m = 0): Date => new Date(2026, 9, 11, h, m);
const nightScene = () => direct(buildWorldState(at(22, 30), { lat: 51.5, lon: -0.1, name: 'London' }, null, null));

describe('bedtime mode (D9)', () => {
  it('starts from 22:00 until 04:00 and not in the day', () => {
    expect([21, 22, 23, 0, 3].map((h) => isBedtimeHour(at(h)))).toEqual([false, true, true, true, true]);
    expect(isBedtimeHour(at(4))).toBe(false);
    expect(isBedtimeHour(at(13))).toBe(false);
  });

  it('lights the fire, darkens slowly, sleeps at ten minutes, then fades to black', () => {
    const start = bedtimeLook(0);
    expect(start).toMatchObject({ dim: 0, fire: 0, asleep: false, fade: 0, over: false });
    const five = bedtimeLook(5 * MIN);
    expect(five.fire).toBe(1);
    expect(five.dim).toBeGreaterThan(0.2);
    expect(five.dim).toBeLessThan(bedtimeLook(9 * MIN).dim);
    expect(five.asleep).toBe(false);
    expect(bedtimeLook(DIM_MS - 1).asleep).toBe(false);
    const asleep = bedtimeLook(DIM_MS + 1000);
    expect(asleep.asleep).toBe(true);
    expect(asleep.fire).toBeLessThan(0.5);
    expect(bedtimeLook(DIM_MS + FADE_MS / 2).fade).toBeGreaterThan(0.3);
    expect(bedtimeLook(DIM_MS + FADE_MS).over).toBe(true);
  });

  it('never goes backwards while the minutes pass', () => {
    let last = bedtimeLook(0);
    for (let m = 1; m <= 12; m++) {
      const look = bedtimeLook(m * MIN);
      expect(look.dim).toBeGreaterThanOrEqual(last.dim);
      last = look;
    }
  });

  it('sits him by the fire, and keeps the same sleeping pose across 2:00', () => {
    const rs = nightScene();
    const awake = applyBedtime(rs, bedtimeLook(3 * MIN));
    expect(awake.wanderer.pace).toBe(0);
    expect(awake.wanderer.lantern).toBe(false);
    expect(awake.wanderer.asleep).toBe(false);
    expect(awake.bedtime.fire).toBeGreaterThan(0.9);
    expect(awake.sky.top).not.toBe(rs.sky.top);
    expect(applyBedtime(rs, bedtimeLook(DIM_MS + 1)).wanderer.asleep).toBe(true);
    // Still awake by the fire when the clock reaches 2:00: the plain sleeping state takes over, no switch of pose.
    const twoAm = direct(buildWorldState(at(2, 30), { lat: 51.5, lon: -0.1, name: 'London' }, null, null));
    expect(twoAm.wanderer.asleep).toBe(true);
    expect(applyBedtime(twoAm, bedtimeLook(3 * MIN)).wanderer.asleep).toBe(true);
  });

  it('is not there in a normal scene', () => {
    expect(nightScene().bedtime.fire).toBe(0);
  });
});
