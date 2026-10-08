import { describe, expect, it } from 'vitest';
import { EMPTY_MAIL, dayKey, deliver, markAllRead, visibleLetters, type Candidate, type Mail } from '../src/core/letters';
import { advance, locate, startJourney } from '../src/core/journey';
import { dayAt, outsetDestination, planOutset, withOutset } from '../src/core/outset';
import { deliveredCards, isDeparture, makePostcard, missingArrivals } from '../src/core/postcards';
import {
  answer,
  dayIndex,
  decodePanels,
  encodePanels,
  firstWeekLetters,
  isQuestionDay,
  momentAllowed,
  packItem,
  questionLetters,
  replyLetters,
  weekPanels,
  type ScriptState,
} from '../src/core/script';
import { demoWeather } from '../src/core/weather';
import type { Home, JourneyState, Postcard } from '../src/core/types';
import { BAG_DEFAULT, BAG_ITEMS, GENERAL_QUESTIONS, SKELETONS, skeletonById, storiesFor } from '../src/data/letterTexts';
import { ROUTES } from '../src/data/routes';

const H = 3_600_000;
const LONDON: Home = { name: 'London', region: 'United Kingdom', lat: 51.51, lon: -0.13 };
const START = new Date(2026, 9, 8, 9, 0).getTime();
const fresh = (start = START): ScriptState => ({ start, anchor: start, answers: {} });
const CTX = { nightTrain: true, questions: GENERAL_QUESTIONS };

describe('the first week, day by day', () => {
  it('counts calendar days, not hours', () => {
    expect(dayIndex(START, START)).toBe(0);
    expect(dayIndex(new Date(2026, 9, 8, 23, 50).getTime(), new Date(2026, 9, 9, 0, 10).getTime())).toBe(1);
    expect(dayIndex(START, dayAt(START, 7, 22))).toBe(7);
  });

  it('writes the first night\'s letter that evening, or soon after a late start', () => {
    const night = firstWeekLetters(fresh(), START, CTX).find((c) => c.id === 'script:night')!;
    expect(night.wantAt).toBe(dayAt(START, 0, 21));
    const late = new Date(2026, 9, 8, 22, 40).getTime();
    expect(firstWeekLetters(fresh(late), late, CTX)[0].wantAt).toBe(late + 30 * 60_000);
  });

  it('asks about the pack on day 1, and keeps quiet about little things on days with their own letter', () => {
    expect(firstWeekLetters(fresh(), dayAt(START, 0, 23), CTX).map((c) => c.id)).toEqual(['script:night']);
    const day1 = firstWeekLetters(fresh(), dayAt(START, 1, 0) + 60_000, CTX);
    expect(day1.find((c) => c.id === 'question:bag')!.wantAt).toBe(dayAt(START, 1, 10));
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => momentAllowed(fresh(), dayAt(START, d, 12)))).toEqual([false, false, false, false, false, false, true, false, true]);
    // An older traveller has no script: little things every day.
    expect(momentAllowed({ start: null, anchor: START, answers: {} }, dayAt(START, 1, 12))).toBe(true);
  });

  it('asks on day 4 aboard the night train, then every four or five days', () => {
    const days = Array.from({ length: 32 }, (_, d) => d).filter(isQuestionDay);
    expect(days).toEqual([4, 8, 13, 17, 22, 26, 31]);
    const q4 = questionLetters(fresh(), dayAt(START, 4, 9), CTX);
    expect(q4).toHaveLength(1);
    expect(q4[0]).toMatchObject({ id: 'question:d4', kind: 'question', wantAt: dayAt(START, 4, 11), pool: ['q.window'] });
    // Someone whose going-out was a flight is asked an everyday question instead.
    expect(questionLetters(fresh(), dayAt(START, 4, 9), { ...CTX, nightTrain: false })[0].pool).toEqual(GENERAL_QUESTIONS);
    // Not on the days between, and not long after.
    expect(questionLetters(fresh(), dayAt(START, 6, 9), CTX).map((c) => c.id)).toEqual(['question:d4']);
    expect(questionLetters(fresh(), dayAt(START, 12, 9), CTX).map((c) => c.id)).toEqual([]);
  });

  it('sends the week of sky on day 7, and waits while the history is on its way', () => {
    const at = dayAt(START, 7, 11);
    expect(firstWeekLetters(fresh(), at, { ...CTX, week: () => null }).some((c) => c.id === 'script:week')).toBe(false);
    const week = firstWeekLetters(fresh(), at, { ...CTX, week: () => 'abc' }).find((c) => c.id === 'script:week')!;
    expect(week).toMatchObject({ kind: 'week', wantAt: dayAt(START, 7, 10), vars: { panels: 'abc' } });
    expect(firstWeekLetters(fresh(), dayAt(START, 7, 9), { ...CTX, week: () => 'abc' }).some((c) => c.id === 'script:week')).toBe(false);
  });
});

describe('his questions and your answers', () => {
  const asked = (at: number): Mail => deliver(EMPTY_MAIL, [{ id: 'question:d4', kind: 'question', wantAt: at, pool: ['q.window'] }], at);
  const Q = dayAt(START, 4, 11);

  it('remember the answer in the next morning\'s letter', () => {
    const mail = asked(Q);
    const s = answer(fresh(), mail, 'question:d4', 'cows', Q + H);
    const [reply] = replyLetters(mail, s, Q + 2 * H);
    expect(reply).toMatchObject({ id: 'reply:question:d4', skeleton: 'q.window.r.cows', wantAt: dayAt(START, 5, 8) });
    // Answered late in the next day: two hours on.
    const late = answer(fresh(), mail, 'question:d4', 'clouds', dayAt(START, 5, 15));
    expect(replyLetters(mail, late, dayAt(START, 5, 15))[0].wantAt).toBe(dayAt(START, 5, 17));
  });

  it('wait for the person: no answer and unseen means no decision yet', () => {
    const mail = asked(Q);
    expect(replyLetters(mail, fresh(), dayAt(START, 9, 12))).toEqual([]);
    // Seen on day 6, still unanswered the evening after: he decides, kindly.
    const seen = markAllRead(mail, dayAt(START, 6, 10));
    expect(replyLetters(seen, fresh(), dayAt(START, 7, 18))).toEqual([]);
    const [none] = replyLetters(seen, fresh(), dayAt(START, 7, 19));
    expect(none).toMatchObject({ skeleton: 'q.window.r.none', wantAt: dayAt(START, 7, 19) });
  });

  it('are settled once the reply is in: later taps change nothing', () => {
    let mail = asked(Q);
    const s = answer(fresh(), mail, 'question:d4', 'trains', Q + H);
    mail = deliver(mail, replyLetters(mail, s, Q + H), Q + H);
    expect(answer(s, mail, 'question:d4', 'cows', Q + 3 * H)).toBe(s);
    expect(replyLetters(mail, s, Q + 30 * H)).toEqual([]);
    // Nor can a question be answered before it arrives.
    expect(answer(fresh(), asked(Q), 'question:d4', 'cows', Q - H).answers).toEqual({});
  });

  it('fill the pack with the person\'s pick, or a pebble he chose himself', () => {
    const at = dayAt(START, 1, 10);
    let mail = deliver(EMPTY_MAIL, [{ id: 'question:bag', kind: 'question', wantAt: at, skeleton: 'q.bag' }], at);
    expect(packItem(mail, fresh(), BAG_DEFAULT)).toBeNull();
    expect(packItem(mail, answer(fresh(), mail, 'question:bag', 'pencil', at + H), BAG_DEFAULT)).toBe('pencil');
    mail = markAllRead(mail, at + H);
    mail = deliver(mail, replyLetters(mail, fresh(), dayAt(START, 2, 19)), dayAt(START, 2, 19));
    expect(packItem(mail, fresh(), BAG_DEFAULT)).toBe('pebble');
  });

  it('have an option and a reply for every answer, and a kind reply for none', () => {
    for (const q of SKELETONS.filter((s) => s.kind === 'question')) {
      expect(q.options!.length, q.id).toBeGreaterThanOrEqual(2);
      for (const o of q.options!) expect(skeletonById(`${q.id}.r.${o.id}`), `${q.id}.r.${o.id}`).toBeDefined();
      expect(skeletonById(`${q.id}.r.none`), q.id).toBeDefined();
    }
    for (const id of GENERAL_QUESTIONS) expect(skeletonById(id)?.kind).toBe('question');
    for (const o of skeletonById('q.bag')!.options!) expect(BAG_ITEMS[o.id], o.id).toBeDefined();
  });
});

describe('the week of sky', () => {
  it('paints seven squares from the sky and weather of each day, whole even when nothing is known', () => {
    const blank = weekPanels(START, LONDON, () => null);
    expect(blank).toHaveLength(7);
    expect(blank.every((p) => p.condition === null)).toBe(true);
    const rainy = weekPanels(START, LONDON, (at) => (dayIndex(START, at) === 2 ? demoWeather('rain', new Date(at)) : null));
    expect(rainy[2].condition).toBe('rain');
    expect(rainy[2].top).not.toBe(rainy[1].top);
    expect(decodePanels(encodePanels(rainy))).toEqual(rainy);
    expect(decodePanels('nonsense,zz.yy.')).toEqual([]);
  });
});

/**
 * The whole week as someone who opens the app three times a day would see it,
 * with only the pure parts: the journey, the postcards, and every letter
 * through the real engine.
 */
describe('a week, opened three times a day', () => {
  it('brings each day its beat, as review v2 wrote it', () => {
    const base = outsetDestination(ROUTES, LONDON);
    const first = base.places[0];
    const outset = planOutset(LONDON, { lat: first.lat!, lon: first.lon! }, START);
    const route = withOutset(base, outset);
    let journey: JourneyState = { ...startJourney(route, START), home: LONDON, from: null, walked: [], outset };
    let script = fresh();
    let mail: Mail = EMPTY_MAIL;
    let cards: Postcard[] = [];
    const answers: Record<string, string> = { 'question:bag': 'button', 'question:d4': 'cows' };
    const visits = [START + 60_000];
    for (let d = 0; d <= 7; d++) for (const h of [9.5, 13, 21.5]) {
      const v = dayAt(START, d, 0) + h * H;
      if (v > START + 60_000) visits.push(v);
    }
    const where: Record<number, string> = {};
    for (const v of visits) {
      journey = advance(route, journey, v).state;
      for (const a of missingArrivals(route, journey, cards)) {
        cards = [...cards, makePostcard(route, a, LONDON, null, { home: LONDON, departure: isDeparture(route, journey, a) })!];
      }
      const pos = locate(route, journey, v);
      where[dayIndex(START, v)] = pos.resting ? `at ${pos.from.id}` : `${pos.mode} to ${pos.to?.id}`;
      const c: Candidate[] = [
        ...deliveredCards(cards, v).map((card): Candidate => ({
          id: `postcard:${card.id}`,
          kind: 'postcard',
          wantAt: card.deliverAt ?? card.at,
          pool: storiesFor(card.terrain, card.departure ? true : card.placeId === 'station' ? 'station' : false).map((s) => s.id),
        })),
        ...firstWeekLetters(script, v, { ...CTX, week: () => 'panels' }),
        ...questionLetters(script, v, CTX),
        ...replyLetters(mail, script, v),
      ];
      if (momentAllowed(script, v)) c.push({ id: `moment:${dayKey(v)}`, kind: 'moment', wantAt: v, pool: ['m.dog', 'm.bird'] });
      mail = deliver(mail, c, v);
      for (const [id, opt] of Object.entries(answers)) script = answer(script, mail, id, opt, v);
      mail = markAllRead(mail, v);
    }
    const byDay: Record<number, string[]> = {};
    for (const l of visibleLetters(mail, dayAt(START, 7, 23)).reverse()) (byDay[dayIndex(START, l.at)] ??= []).push(l.skeleton);

    // Where he is: the lane, the fields, the small town, the station, the train, the first place.
    expect(where[0]).toBe('walk to station');
    expect(where[2]).toBe('walk to station');
    expect(where[3]).toMatch(/^ride to /);
    expect(where[4]).toBe(`ride to ${first.id}`);
    expect(where[6]).toMatch(/^walk to /);

    expect(byDay[0]).toEqual(['s.depart1', 'd0.night']);
    expect(byDay[1]).toEqual(['q.bag']);
    expect(byDay[2]).toEqual(['q.bag.r.button']);
    expect(byDay[3]).toHaveLength(1);
    expect(['st.bench', 'st.rails']).toContain(byDay[3][0]);
    expect(byDay[4]).toEqual(['q.window']);
    expect(byDay[5]?.[0]).toBe('q.window.r.cows');
    expect(byDay[6]).toContain('m.dog');
    expect(byDay[7]).toContain('k.week');
    // The first real place's card: posted at dawn on day 5, in the box by day 7.
    expect(cards.find((c) => c.placeId === first.id)!.deliverAt!).toBeLessThanOrEqual(dayAt(START, 7, 10));
    expect(Object.values(byDay).flat().filter((s) => storiesFor('city').some((x) => x.id === s) || s.startsWith('s.')).length).toBeGreaterThanOrEqual(2);
    // Never more than two a day.
    for (const list of Object.values(byDay)) expect(list.length).toBeLessThanOrEqual(2);
  });
});
