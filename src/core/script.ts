import type { Candidate, Mail } from './letters';
import { dayAt } from './outset';
import { direct } from './sceneDirector';
import type { GeoPoint, WeatherCondition, WeatherState } from './types';
import { buildWorldState } from './world';

/**
 * The first week's script (decisions D8; review v2, section 4), and his
 * questions. Not fake letters: every beat is a candidate for the real letter
 * engine, which seats it by the usual rules. The days:
 *
 *   0  the lane outside home     the first letter, that same night
 *   1  the fields                may he take one thing of yours (the pack)
 *   2  a small town              a small surprise for sure: a cat, if the
 *                                day brings nothing of its own (surprises.ts)
 *   3  the little station        the station's postcard; the night train
 *   4  on the night train        his first question
 *   5  in at dawn                his letter remembers your answer
 *   6  the first real place      its postcard is in the post
 *   7  there                     the week of sky: seven squares of your sky
 *
 * Where he is comes from the going-out stretch (outset.ts); this file only
 * says what he writes and when. Nothing here counts opens: someone who did
 * not come all week gets the same week of sky, just as whole.
 */

const H = 3_600_000;
const DAY = 24 * H;

export interface Answer {
  option: string;
  at: number;
}

export interface ScriptState {
  /** Day 0 of the first week: when the first journey began. Null for travellers from before the script. */
  start: number | null;
  /** His questions count their days from here (the script's start, or when an older traveller first met them). */
  anchor: number;
  /** The person's answers to his questions, by the question letter's id. */
  answers: Record<string, Answer>;
}

/** Calendar days from `from` to `now`, by the device's clock (0 on the same day). */
export function dayIndex(from: number, now: number): number {
  const a = new Date(from);
  const b = new Date(now);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / DAY);
}

/** The day of the first week, or null outside the script (an older traveller). */
export function scriptDay(s: ScriptState, now: number): number | null {
  return s.start === null ? null : dayIndex(s.start, now);
}

/** The first week's days that bring a letter of their own: no random little thing then. Day 6 keeps one. */
const OWN_LETTER_DAYS = new Set([0, 1, 2, 3, 4, 5, 7]);

/** May the day's little thing from the road come today? */
export function momentAllowed(s: ScriptState, now: number): boolean {
  const d = scriptDay(s, now);
  return d === null || d < 0 || d > 7 || !OWN_LETTER_DAYS.has(d);
}

/** The days he asks something: day 4, then every four or five days (one or two a week). */
export function isQuestionDay(d: number): boolean {
  for (let k = 0; ; k++) {
    const n = 4 + Math.floor(k * 4.5);
    if (n === d) return true;
    if (n > d) return false;
  }
}

/** How far back a question day is still asked when the app was not opened on it. */
const QUESTION_CATCH_UP_DAYS = 3;

export interface ScriptContext {
  /** The going-out stretch has a night train (not a plane): day 4's question is asked aboard it. */
  nightTrain: boolean;
  /** The general questions, in order; the engine picks the first not yet asked. */
  questions: string[];
  /** The week of sky, ready to put in a letter; null to wait a moment (the weather history is on its way). */
  week?: () => string | null;
}

/**
 * The first week's own letters due by `now`: each is offered from the start
 * of its day, so the letter engine keeps its place in that day's two.
 */
export function firstWeekLetters(s: ScriptState, now: number, ctx: ScriptContext): Candidate[] {
  const d = scriptDay(s, now);
  if (s.start === null || d === null || d < 0) return [];
  const start = s.start;
  const out: Candidate[] = [
    // The first night: in the evening, or a little after setting out when that is later.
    { id: 'script:night', kind: 'moment', wantAt: Math.max(dayAt(start, 0, 21), start + 30 * 60_000), skeleton: 'd0.night' },
  ];
  if (d >= 1) out.push({ id: 'question:bag', kind: 'question', wantAt: dayAt(start, 1, 10), skeleton: 'q.bag' });
  const weekAt = dayAt(start, 7, 10);
  if (d >= 7 && d <= 14 && now >= weekAt) {
    const panels = ctx.week?.() ?? null;
    if (panels) out.push({ id: 'script:week', kind: 'week', wantAt: weekAt, skeleton: 'k.week', vars: { panels } });
  }
  return out;
}

/** His questions: on day 4 (aboard the night train in the first week), then every four or five days. */
export function questionLetters(s: ScriptState, now: number, ctx: ScriptContext): Candidate[] {
  const today = dayIndex(s.anchor, now);
  const out: Candidate[] = [];
  for (let d = Math.max(4, today - QUESTION_CATCH_UP_DAYS); d <= today; d++) {
    if (!isQuestionDay(d)) continue;
    const onTrain = d === 4 && s.start !== null && s.start === s.anchor && ctx.nightTrain;
    out.push({
      id: `question:d${d}`,
      kind: 'question',
      wantAt: dayAt(s.anchor, d, 11),
      pool: onTrain ? ['q.window'] : ctx.questions,
    });
  }
  return out;
}

/** A question is settled once its reply is in the box: the options no longer change anything. */
export function isSettled(mail: Mail, questionId: string): boolean {
  return mail.letters.some((l) => l.id === `reply:${questionId}`);
}

/**
 * The letters that answer the person's answers. An answer is remembered in
 * the next morning's letter (or two hours on, if it came later). With no
 * answer, nothing happens until the question has been seen; a day after
 * that he decides for himself, in a letter without a word of blame.
 */
export function replyLetters(mail: Mail, s: ScriptState, now: number): Candidate[] {
  const out: Candidate[] = [];
  for (const q of mail.letters) {
    if (q.kind !== 'question' || q.at > now || isSettled(mail, q.id)) continue;
    const a = s.answers[q.id];
    if (a) {
      out.push({ id: `reply:${q.id}`, kind: 'moment', wantAt: Math.max(a.at + 2 * H, dayAt(q.at, 1, 8)), skeleton: `${q.skeleton}.r.${a.option}` });
    } else if (q.readAt !== undefined) {
      const due = dayAt(q.readAt, 1, 19);
      if (now >= due) out.push({ id: `reply:${q.id}`, kind: 'moment', wantAt: due, skeleton: `${q.skeleton}.r.none` });
    }
  }
  return out;
}

/** Record an answer, unless the question is not in the box yet or already settled. Same state when refused. */
export function answer(s: ScriptState, mail: Mail, questionId: string, option: string, now: number): ScriptState {
  const q = mail.letters.find((l) => l.id === questionId && l.kind === 'question');
  if (!q || q.at > now || isSettled(mail, questionId)) return s;
  return { ...s, answers: { ...s.answers, [questionId]: { option, at: now } } };
}

/**
 * What is in his pack: the person's pick, or the pebble he took himself when
 * nobody chose (once his reply has gone). Null before the question.
 */
export function packItem(mail: Mail, s: ScriptState, fallback: string): string | null {
  const q = mail.letters.find((l) => l.kind === 'question' && l.skeleton === 'q.bag');
  if (!q) return null;
  const a = s.answers[q.id];
  if (a) return a.option;
  return isSettled(mail, q.id) ? fallback : null;
}

/* ------------------------------------------------------------------------ */
/* The week of sky                                                           */
/* ------------------------------------------------------------------------ */

export interface SkyPanel {
  top: number;
  horizon: number;
  /** The weather that day, when it is known; null paints a clear sky. */
  condition: WeatherCondition | null;
}

/** The hour of each day the week of sky is painted at. */
export const WEEK_HOUR = 13;

/**
 * Seven squares of the person's sky, one for each day of the first week, at
 * the same early-afternoon hour: the sky's colours from the sun and the
 * weather of that day. Weather that is not known is simply a clear sky; the
 * picture is always whole.
 */
export function weekPanels(start: number, location: GeoPoint, weatherOn: (at: number) => WeatherState | null): SkyPanel[] {
  const out: SkyPanel[] = [];
  for (let d = 0; d < 7; d++) {
    const at = dayAt(start, d, WEEK_HOUR);
    const w = weatherOn(at);
    const rs = direct(buildWorldState(new Date(at), location, w, null));
    out.push({ top: rs.sky.top, horizon: rs.sky.horizon, condition: w?.condition ?? null });
  }
  return out;
}

/** Panels as a letter keeps them: plain text. */
export function encodePanels(panels: SkyPanel[]): string {
  return panels.map((p) => `${p.top.toString(16).padStart(6, '0')}.${p.horizon.toString(16).padStart(6, '0')}.${p.condition ?? ''}`).join(',');
}

export function decodePanels(text: string): SkyPanel[] {
  return text
    .split(',')
    .map((part) => part.split('.'))
    .filter((p) => p.length === 3 && /^[0-9a-f]{6}$/.test(p[0]) && /^[0-9a-f]{6}$/.test(p[1]))
    .map(([top, horizon, condition]) => ({ top: parseInt(top, 16), horizon: parseInt(horizon, 16), condition: (condition || null) as WeatherCondition | null }));
}
