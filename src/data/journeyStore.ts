import type { JourneyState } from '../core/types';

/**
 * Saves the journey in localStorage. Small, synchronous and good enough for
 * now; a cloud backup comes later. Every read is validated so a stale or
 * hand-edited entry can only ever mean "start again", never a crash.
 */

const KEY = 'wanderling.journey';

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

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isHome(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (!v || typeof v !== 'object') return false;
  const h = v as Record<string, unknown>;
  return typeof h.name === 'string' && num(h.lat) && num(h.lon);
}

export function isJourneyState(v: unknown): v is JourneyState {
  if (!v || typeof v !== 'object') return false;
  const j = v as Record<string, unknown>;
  return (
    isHome(j.home) &&
    isHome(j.from) &&
    (j.walked === undefined || (Array.isArray(j.walked) && j.walked.every((w) => typeof w === 'string'))) &&
    typeof j.routeId === 'string' &&
    num(j.startedAt) &&
    num(j.km) &&
    num(j.updatedAt) &&
    (j.restingUntil === null || num(j.restingUntil)) &&
    Array.isArray(j.arrivals) &&
    j.arrivals.every((a) => a && typeof (a as { placeId: unknown }).placeId === 'string' && num((a as { at: unknown }).at)) &&
    num(j.bonusKm)
  );
}

export function loadJourney(storage: StorageLike | null = defaultStorage()): JourneyState | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isJourneyState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveJourney(state: JourneyState, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full disk: the journey still runs for this visit.
  }
}
