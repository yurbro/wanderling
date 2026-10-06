import type { Postcard } from '../core/types';

/** The album on disk: a list of postcards in localStorage, newest last. */

const KEY = 'wanderling.postcards';
const MAX = 300;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';

export function isPostcard(v: unknown): v is Postcard {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  const colors = c.colors as Record<string, unknown> | undefined;
  return (
    str(c.id) &&
    str(c.routeId) &&
    str(c.placeId) &&
    str(c.placeName) &&
    str(c.terrain) &&
    num(c.at) &&
    (c.deliverAt === undefined || num(c.deliverAt)) &&
    str(c.note) &&
    (c.weather === null || (!!c.weather && typeof c.weather === 'object')) &&
    !!colors &&
    ['skyTop', 'skyHorizon', 'hillFar', 'hillNear', 'ground', 'sea'].every((k) => num(colors[k])) &&
    typeof c.darkInk === 'boolean' &&
    num(c.seaAmount)
  );
}

export function loadPostcards(storage: StorageLike | null = defaultStorage()): Postcard[] {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPostcard);
  } catch {
    return [];
  }
}

export function savePostcards(cards: Postcard[], storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(cards.slice(-MAX)));
  } catch {
    // Storage full or unavailable: the album lives in memory for this visit.
  }
}

export function clearPostcards(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem?.(KEY);
  } catch {
    // Nothing to do.
  }
}
