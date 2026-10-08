import type { Answer, ScriptState } from '../core/script';

/**
 * The first week's script and the answers to his questions, in localStorage.
 * A demo run (?day=) keeps its answers apart, so trying the first week on a
 * phone never touches the real one.
 */

const KEY = 'wanderling.script';
const DEMO_KEY = 'wanderling.demoAnswers';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanAnswers(v: unknown): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, a] of Object.entries(v as Record<string, unknown>)) {
    const x = a as Record<string, unknown> | null;
    if (x && typeof x.option === 'string' && num(x.at)) out[id] = { option: x.option, at: x.at };
  }
  return out;
}

export function loadScript(): ScriptState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!num(p.anchor) || !(p.start === null || num(p.start))) return null;
    return { start: p.start as number | null, anchor: p.anchor, answers: cleanAnswers(p.answers) };
  } catch {
    return null;
  }
}

export function saveScript(s: ScriptState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Fine: the week still runs for this visit.
  }
}

/** Demo answers, by question letter id: option only (the demo's clock moves every time). */
export function loadDemoAnswers(): Record<string, string> {
  try {
    const p = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch {
    return {};
  }
}

export function saveDemoAnswers(a: Record<string, string>): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(a));
  } catch {
    // Fine.
  }
}

export function clearDemoAnswers(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // Fine.
  }
}
