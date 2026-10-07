import { EMPTY_MAIL, type Letter, type Mail } from '../core/letters';

/** The letter box on disk: in localStorage, like the album. */

const KEY = 'wanderling.mail';
const MAX = 400;

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

const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isLetter(v: unknown): v is Letter {
  if (!v || typeof v !== 'object') return false;
  const l = v as Record<string, unknown>;
  return str(l.id) && str(l.kind) && num(l.at) && str(l.skeleton) && typeof l.read === 'boolean' && !!l.vars && typeof l.vars === 'object';
}

export function loadMail(storage: StorageLike | null = defaultStorage()): Mail {
  if (!storage) return EMPTY_MAIL;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_MAIL;
    const parsed = JSON.parse(raw) as { letters?: unknown; used?: unknown };
    const letters = Array.isArray(parsed.letters) ? parsed.letters.filter(isLetter) : [];
    const used = Array.isArray(parsed.used) ? parsed.used.filter(str) : [];
    return { letters, used };
  } catch {
    return EMPTY_MAIL;
  }
}

export function saveMail(mail: Mail, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    const letters = mail.letters.length > MAX ? mail.letters.slice(mail.letters.length - MAX) : mail.letters;
    storage.setItem(KEY, JSON.stringify({ letters, used: mail.used }));
  } catch {
    // Storage full or blocked: the letters live on in memory for this session.
  }
}

export function clearMail(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem?.(KEY);
  } catch {
    // Fine.
  }
}
