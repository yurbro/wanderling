import { EMPTY_LOG, type SurpriseEvent, type SurpriseLog } from '../core/surprises';

/** The surprise log on disk: in localStorage, like the album and the letter box. */

const KEY = 'wanderling.surprises';
const SEEN_KEY = 'wanderling.lastSeen';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const IDS = new Set(['rainbow', 'fullMoon', 'asleep', 'snowGlobe', 'wave', 'cat']);

function isEvent(v: unknown): v is SurpriseEvent {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && IDS.has(e.id) && typeof e.at === 'number' && typeof e.until === 'number' && typeof e.witnessed === 'boolean';
}

export function loadSurprises(storage: StorageLike | null = defaultStorage()): SurpriseLog {
  if (!storage) return EMPTY_LOG;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_LOG;
    const parsed = JSON.parse(raw) as { events?: unknown };
    return { events: Array.isArray(parsed.events) ? parsed.events.filter(isEvent) : [] };
  } catch {
    return EMPTY_LOG;
  }
}

export function saveSurprises(log: SurpriseLog, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage full or blocked: the log lives on in memory for this session.
  }
}

/** When the app last had a tick with the page visible, or null on a first visit. */
export function loadLastSeen(storage: StorageLike | null = defaultStorage()): number | null {
  try {
    const n = Number(storage?.getItem(SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveLastSeen(at: number, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(SEEN_KEY, String(at));
  } catch {
    // Fine.
  }
}
