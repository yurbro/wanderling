import { describe, expect, it } from 'vitest';
import { DIM_MS, FADE_MS, applyBedtime, bedtimeHolds, bedtimeLook, bedtimePlan, isBedtimeHour, nightOf } from '../src/core/bedtime';
import { EMPTY_MAIL, deliver } from '../src/core/letters';
import { REST_MS, advance, hold, locate, startJourney } from '../src/core/journey';
import { routeFromHome } from '../src/core/geo';
import { TO_THE_SEA } from '../src/data/routes';
import { direct } from '../src/core/sceneDirector';
import { buildWorldState } from '../src/core/world';

const MIN = 60_000;
const at = (h: number, m = 0): Date => new Date(2026, 9, 11, h, m);
const nightScene = () => direct(buildWorldState(at(22, 30), { lat: 51.5, lon: -0.1, name: 'London' }, null, null));

describe('bedtime mode (D9)', () => {
  it('starts from 22:00 until 02:00 and not in the day (ruling 27)', () => {
    expect([21, 22, 23, 0, 1].map((h) => isBedtimeHour(at(h)))).toEqual([false, true, true, true, true]);
    // From 2:00 he is simply asleep by the road (ruling 1): no fire.
    expect(isBedtimeHour(at(2))).toBe(false);
    expect(isBedtimeHour(at(3))).toBe(false);
    expect(isBedtimeHour(at(13))).toBe(false);
  });

  it('plays once a night: after he slept by the fire, opening again finds him asleep (ruling 28)', () => {
    expect(nightOf(at(23))).toBe(nightOf(new Date(2026, 9, 12, 1, 30)));
    expect(nightOf(at(23))).not.toBe(nightOf(new Date(2026, 9, 12, 23)));
    expect(bedtimePlan(at(23), null)).toBe('fire');
    expect(bedtimePlan(at(23), nightOf(at(22)))).toBe('asleep');
    expect(bedtimePlan(new Date(2026, 9, 12, 1), nightOf(at(22)))).toBe('asleep');
    expect(bedtimePlan(new Date(2026, 9, 12, 23), nightOf(at(22)))).toBe('fire');
    expect(bedtimePlan(at(15), null)).toBeNull();
    const again = bedtimeLook(0, { sleptTonight: true });
    expect(again.asleep).toBe(true);
    expect(again.fire).toBe(0);
    expect(bedtimeLook(FADE_MS, { sleptTonight: true }).over).toBe(true);
  });

  it('lights no fire aboard a train: he dozes in his seat (ruling 26)', () => {
    const aboard = bedtimeLook(5 * MIN, { aboard: true });
    expect(aboard.fire).toBe(0);
    expect(aboard.dim).toBeCloseTo(bedtimeLook(5 * MIN).dim, 6);
    expect(bedtimeLook(DIM_MS + 1, { aboard: true }).asleep).toBe(true);
  });

  it('holds the road still and the post back while it runs (ruling 26)', () => {
    const T0 = new Date(2026, 9, 11, 22, 30).getTime();
    const route = routeFromHome(TO_THE_SEA, { name: 'Brighton', lat: 50.82, lon: -0.14 });
    const walking = advance(route, startJourney(route, T0 - 10 * MIN), T0).state;
    expect(walking.km).toBeGreaterThan(0);
    const held = hold(route, walking, T0 + 8 * MIN);
    expect(held.state.km).toBe(walking.km);
    expect(held.state.updatedAt).toBe(T0 + 8 * MIN);
    expect(held.arrived).toEqual([]);
    // The hold over, the walk goes on from where it stood, not from where it would have been.
    const after = advance(route, held.state, T0 + 10 * MIN).state;
    expect(after.km).toBeCloseTo(walking.km + advance(route, walking, T0 + 2 * MIN).state.km - walking.km, 6);
    // A rest under way ends that much later.
    const resting = { ...walking, restingUntil: T0 + 60 * MIN };
    expect(hold(route, resting, T0 + 8 * MIN).state.restingUntil).toBe(T0 + 68 * MIN);
    // Aboard a train the train carries him on (ruling 11).
    const far = routeFromHome(TO_THE_SEA, { name: 'Berlin', lat: 52.52, lon: 13.4 });
    const riding = advance(far, startJourney(far, T0 - 10 * MIN), T0).state;
    expect(locate(far, riding, T0).mode).toBe('ride');
    expect(hold(far, riding, T0 + 8 * MIN).state.km).toBeGreaterThan(riding.km);
    // No letter lands by the fire; the same candidates land at the next opening.
    const candidate = { id: 'moment:x', kind: 'moment' as const, wantAt: T0, skeleton: 'm.dog' };
    expect(deliver(EMPTY_MAIL, [candidate], T0 + MIN, { quiet: true })).toBe(EMPTY_MAIL);
    expect(deliver(EMPTY_MAIL, [candidate], T0 + 20 * MIN).letters).toHaveLength(1);
    expect(bedtimeHolds(bedtimeLook(3 * MIN))).toBe(true);
    expect(bedtimeHolds(bedtimeLook(DIM_MS + FADE_MS))).toBe(false);
    expect(REST_MS).toBeGreaterThan(0);
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
    expect(awake.ground).not.toBe(rs.ground);
    expect(applyBedtime(rs, bedtimeLook(DIM_MS + 1)).wanderer.asleep).toBe(true);
    // Still awake by the fire when the clock reaches 2:00: the plain sleeping state takes over, no switch of pose.
    const twoAm = direct(buildWorldState(at(2, 30), { lat: 51.5, lon: -0.1, name: 'London' }, null, null));
    expect(twoAm.wanderer.asleep).toBe(true);
    expect(applyBedtime(twoAm, bedtimeLook(3 * MIN)).wanderer.asleep).toBe(true);
  });

  it('leaves the sky alone: the moon and the stars stay as they are, only the land and the HUD go dark (Q5)', () => {
    const rs = nightScene();
    const late = applyBedtime(rs, bedtimeLook(9 * MIN));
    expect(late.sky).toEqual(rs.sky);
    expect(late.moon).toEqual(rs.moon);
    expect(late.starAlpha).toBe(rs.starAlpha);
    expect(late.surprise).toEqual(rs.surprise);
    expect(late.ground).not.toBe(rs.ground);
    expect(late.hills.near).not.toBe(rs.hills.near);
    expect(late.light).toBeLessThan(rs.light);
  });

  it('is not there in a normal scene', () => {
    expect(nightScene().bedtime.fire).toBe(0);
  });
});
