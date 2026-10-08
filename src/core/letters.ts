/**
 * The letter engine: what the wanderling writes, and when it reaches the
 * person. Pure functions over plain data; the texts live in
 * src/data/letterTexts.ts and the store in src/data/mailStore.ts.
 *
 * Rules (docs/design/decisions.md section 8):
 * - at most two letters a day;
 * - of a postcard, a sky letter and a missed-you letter, only one a day,
 *   the highest priority first, the rest pushed to the next morning;
 * - at most three unread in the box: beyond that the older ones fold into
 *   one "a few things from the road";
 * - a skeleton is not used twice until every one of its kind has been;
 * - a question, and the week of sky, never fold: they stay on their own sheet.
 */

export type LetterKind = 'postcard' | 'moment' | 'weather' | 'sky' | 'missed' | 'question' | 'week' | 'digest';

export interface Letter {
  /** Unique; the candidate's id. */
  id: string;
  kind: LetterKind;
  /** When it reaches the person, milliseconds since the epoch. */
  at: number;
  /** The skeleton in letterTexts, or `place:<routeId>:<placeId>` for a place's own line. */
  skeleton: string;
  vars: Record<string, string>;
  read: boolean;
  /** When the box was first opened with it in: questions wait for that before he decides alone. */
  readAt?: number;
  /** Folded into a digest: shown there, not on its own. */
  folded?: boolean;
  /** Digests: the ids of the letters folded in, oldest first. */
  bundle?: string[];
}

export interface Mail {
  letters: Letter[];
  /** Skeleton ids already used, so nothing repeats. */
  used: string[];
}

/** Something that could become a letter. */
export interface Candidate {
  id: string;
  kind: Exclude<LetterKind, 'digest'>;
  /** Earliest it should arrive. */
  wantAt: number;
  /** Either a fixed skeleton, or a pool to pick an unused one from. */
  skeleton?: string;
  pool?: string[];
  vars?: Record<string, string>;
  /** Only worth sending on its own day (tomorrow's weather): dropped rather than pushed. */
  sameDayOnly?: boolean;
}

export const EMPTY_MAIL: Mail = { letters: [], used: [] };

/** Letters a day, all kinds together. */
export const LETTERS_PER_DAY = 2;
/** Unread letters shown singly before the rest fold into a digest. */
export const UNREAD_LIMIT = 3;
/** Pushed letters arrive at this hour the next day. */
export const NEXT_MORNING_HOUR = 9;

/** Of the kinds that share a day, who goes first. */
const PRIORITY: Partial<Record<LetterKind, number>> = { postcard: 3, missed: 2, sky: 1 };
const EXCLUSIVE = new Set<LetterKind>(['postcard', 'sky', 'missed']);

/** The local calendar day of a moment, as a key. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The next day's morning, local time. */
export function nextMorning(ms: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + 1);
  d.setHours(NEXT_MORNING_HOUR, 0, 0, 0);
  return d.getTime();
}

/**
 * Take in candidates and place them in the box, honouring the daily limits.
 * Candidates already in the box are ignored; the rest are seated in
 * priority order, each pushed to later mornings until a day has room.
 */
export function deliver(mail: Mail, candidates: Candidate[], now: number): Mail {
  const have = new Set(mail.letters.map((l) => l.id));
  const fresh = candidates
    .filter((c) => !have.has(c.id))
    .sort((a, b) => (PRIORITY[b.kind] ?? 0) - (PRIORITY[a.kind] ?? 0) || a.wantAt - b.wantAt);
  if (fresh.length === 0) return mail;

  const letters = [...mail.letters];
  let used = [...mail.used];
  for (const c of fresh) {
    let at = c.wantAt;
    let seated = false;
    for (let guard = 0; guard < 30; guard++) {
      const day = dayKey(at);
      const sameDay = letters.filter((l) => l.kind !== 'digest' && dayKey(l.at) === day);
      const full = sameDay.length >= LETTERS_PER_DAY;
      const clash = EXCLUSIVE.has(c.kind) && sameDay.some((l) => EXCLUSIVE.has(l.kind));
      if (!full && !clash) {
        seated = true;
        break;
      }
      if (c.sameDayOnly) break;
      at = nextMorning(at);
    }
    if (!seated && c.sameDayOnly) continue;
    let skeleton = c.skeleton;
    if (!skeleton) {
      const pool = c.pool ?? [];
      let unused = pool.filter((id) => !used.includes(id));
      if (unused.length === 0 && pool.length > 0) {
        // Every line of this kind has gone out once: start the round again.
        used = used.filter((id) => !pool.includes(id));
        unused = pool;
      }
      skeleton = unused[0] ?? 'none';
    }
    if (!used.includes(skeleton)) used.push(skeleton);
    letters.push({ id: c.id, kind: c.kind, at, skeleton, vars: c.vars ?? {}, read: false });
  }
  return fold({ letters, used }, now);
}

/** A question needs its own sheet to be answered; the week of sky is a picture. */
const FOLDABLE = (k: LetterKind): boolean => k !== 'digest' && k !== 'question' && k !== 'week';

/**
 * Keep the box calm: when more than UNREAD_LIMIT letters sit unread, the
 * older ones fold into one digest, leaving the newest two on their own.
 */
export function fold(mail: Mail, now: number): Mail {
  const unread = mail.letters.filter((l) => l.at <= now && !l.read && !l.folded && FOLDABLE(l.kind)).sort((a, b) => a.at - b.at);
  if (unread.length <= UNREAD_LIMIT) return mail;
  const toFold = unread.slice(0, unread.length - (UNREAD_LIMIT - 1));
  const foldIds = new Set(toFold.map((l) => l.id));
  let letters = mail.letters.map((l) => (foldIds.has(l.id) ? { ...l, folded: true } : l));
  const existing = letters.find((l) => l.kind === 'digest' && !l.read);
  const latestAt = Math.max(...toFold.map((l) => l.at));
  if (existing) {
    letters = letters.map((l) => (l === existing ? { ...l, at: Math.max(l.at, latestAt), bundle: [...(l.bundle ?? []), ...toFold.map((x) => x.id)] } : l));
  } else {
    letters.push({ id: `digest:${latestAt}`, kind: 'digest', at: latestAt, skeleton: 'digest', vars: {}, read: false, bundle: toFold.map((l) => l.id) });
  }
  return { ...mail, letters };
}

/** Letters that have arrived and stand on their own, newest first. */
export function visibleLetters(mail: Mail, now: number): Letter[] {
  return mail.letters.filter((l) => l.at <= now && !l.folded).sort((a, b) => b.at - a.at);
}

export function unreadCount(mail: Mail, now: number): number {
  return visibleLetters(mail, now).filter((l) => !l.read).length;
}

/** Opening the box reads everything that has arrived, digests and their bundles included. */
export function markAllRead(mail: Mail, now: number): Mail {
  return { ...mail, letters: mail.letters.map((l) => (l.at <= now ? { ...l, read: true, readAt: l.readAt ?? now } : l)) };
}

/** The letters folded into a digest, oldest first. */
export function bundled(mail: Mail, digest: Letter): Letter[] {
  const ids = digest.bundle ?? [];
  return ids.map((id) => mail.letters.find((l) => l.id === id)).filter((l): l is Letter => !!l);
}

/** Fill `{slot}` marks in a skeleton's text. */
export function fillSlots(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/**
 * A letter a day for the little things: a time of day picked from the date,
 * so it is the same whenever the app is opened, between mid-morning and evening.
 */
export function momentTime(day: string): number {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  const [y, m, d] = day.split('-').map(Number);
  const hour = 10 + (h % 9); // 10:00 to 18:00
  const minute = (h >> 4) % 60;
  return new Date(y, m - 1, d, hour, minute, 0, 0).getTime();
}

/** The evening hour at which a word about tomorrow's weather goes out. */
export function weatherTime(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 18, 30, 0, 0).getTime();
}
