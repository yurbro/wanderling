import { describe, expect, it } from 'vitest';
import { SKELETONS } from '../src/data/letterTexts';
import { ROUTES } from '../src/data/routes';

/**
 * The red lines from docs/design/decisions.md section 6, checked on every
 * line the wanderling can say: letter skeletons and the places' own notes.
 */

const FORBIDDEN_EN = [
  /you missed/i,
  /long time no see/i,
  /\b\d+ days? in a row\b/i,
  /\bstreak\b/i,
  /haven'?t (been|opened|visited)/i,
  /since you (last|were)/i,
  /where (have|were) you/i,
  /don'?t forget/i,
  /you should/i,
];
const FORBIDDEN_ZH = [/你错过/, /好久不见/, /连续\s*\d+\s*天/, /你(怎么|都)没/, /别忘了/, /你应该/, /—/];

interface Line {
  where: string;
  en: string;
  zh: string;
  /** Weather letters may remind, once; nothing else may. */
  reminderAllowed: boolean;
}

const lines: Line[] = [
  ...SKELETONS.map((s) => ({ where: `skeleton ${s.id}`, en: s.en, zh: s.zh, reminderAllowed: s.kind === 'weather' })),
  ...ROUTES.flatMap((r) =>
    r.places
      .filter((p) => p.note)
      .map((p) => ({ where: `${r.id}/${p.id}`, en: p.note!, zh: p.zh?.note ?? '', reminderAllowed: false })),
  ),
];

describe('every line the wanderling says', () => {
  it('stays clear of the red lines', () => {
    for (const l of lines) {
      for (const re of FORBIDDEN_EN) expect(l.en, `${l.where}: ${l.en}`).not.toMatch(re);
      for (const re of FORBIDDEN_ZH) expect(l.zh, `${l.where}: ${l.zh}`).not.toMatch(re);
    }
  });

  it('keeps every English sentence to twelve words or fewer', () => {
    for (const l of lines) {
      const text = l.en.replace(/\{\w+\}/g, 'Porto');
      const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      for (const s of sentences) {
        const words = s.split(/\s+/).length;
        expect(words, `${l.where}: "${s}"`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('has a Chinese line for every English one, without the long dash', () => {
    for (const s of SKELETONS) {
      expect(s.zh.length, s.id).toBeGreaterThan(0);
      expect(s.zh).not.toContain('—');
    }
  });

  it('does not count minutes or openings in everyday lines', () => {
    for (const l of lines) {
      if (l.reminderAllowed) continue;
      expect(l.en, l.where).not.toMatch(/\b(minutes?|hours?) (you|since)/i);
      expect(l.en, l.where).not.toMatch(/\bopen(ed)? the app\b/i);
    }
  });
});
