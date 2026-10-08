import { cleanName } from '../core/name';

/**
 * The wanderling's name and the moment the introduction ended, in
 * localStorage. Every read is validated: a bad entry means "no name yet".
 */

const NAME_KEY = 'wanderling.name';
const STARTED_KEY = 'wanderling.startedAt';

export function loadName(): string | null {
  try {
    const v = localStorage.getItem(NAME_KEY);
    return v ? cleanName(v) || null : null;
  } catch {
    return null;
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Fine.
  }
}

/** When the person first opened the app, or null if the introduction has not finished. */
export function loadStartedAt(): number | null {
  try {
    const n = Number(localStorage.getItem(STARTED_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveStartedAt(at: number): void {
  try {
    if (!localStorage.getItem(STARTED_KEY)) localStorage.setItem(STARTED_KEY, String(at));
  } catch {
    // Fine.
  }
}

const STARTED_INTRO_KEY = 'wanderling.introStarted';

/** The full introduction has begun at least once (so closing the app halfway replays it, not just the naming). */
export function introWasStarted(): boolean {
  try {
    return localStorage.getItem(STARTED_INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroStarted(): void {
  try {
    localStorage.setItem(STARTED_INTRO_KEY, '1');
  } catch {
    // Fine.
  }
}
