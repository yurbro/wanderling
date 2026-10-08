import { describe, expect, it } from 'vitest';
import { BAG_ITEMS, SKELETONS, skyLine, skyVars, storiesFor } from '../src/data/letterTexts';
import { STATION_PLACE } from '../src/core/outset';
import { setLang, t } from '../src/core/i18n';
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

/** What the wanderling (or the firefly beside him) says in the HUD, in both languages. */
const HUD_VOICE = ['hushAsleep', 'postcardPosted', 'postcardArrived', 'letterArrived', 'homeAgain', 'noMail', 'noPostcards',
  'introLook', 'introWhy', 'introNoName', 'introSayName', 'introSaySky', 'introSayLetter', 'askShake',
  'questionArrived', 'answerKept', 'packHolds', 'catFollows', 'boardedNight', 'nightTrainTo', 'arrivesLater'] as const;
const said = (key: (typeof HUD_VOICE)[number]): { en: string; zh: string } => {
  setLang('zh');
  const zh = t(key);
  setLang('en');
  return { en: t(key), zh };
};

const lines: Line[] = [
  ...HUD_VOICE.map((k) => ({ where: `hud ${k}`, ...said(k), reminderAllowed: false })),
  ...SKELETONS.map((s) => ({ where: `skeleton ${s.id}`, en: s.en, zh: s.zh, reminderAllowed: s.kind === 'weather' })),
  ...SKELETONS.flatMap((s) => (s.options ?? []).map((o) => ({ where: `option ${s.id}/${o.id}`, en: o.en, zh: o.zh, reminderAllowed: false }))),
  ...Object.entries(BAG_ITEMS).map(([id, b]) => ({ where: `pack ${id}`, en: `${b.en}. ${b.short.en}.`, zh: `${b.zh}。${b.short.zh}。`, reminderAllowed: false })),
  { where: 'station', en: STATION_PLACE.en.note, zh: STATION_PLACE.zh.note, reminderAllowed: false },
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

describe('the first week\'s new lines (ruling 16)', () => {
  it('name him rather than say "he"', () => {
    for (const k of ['questionArrived', 'answerKept', 'packHolds', 'catFollows', 'boardedNight'] as const) {
      const { en, zh } = said(k);
      expect(en, k).toContain('{name}');
      expect(zh, k).toContain('{name}');
      expect(en, k).not.toMatch(/\b(he|him|his)\b/i);
    }
    for (const s of SKELETONS.filter((x) => x.kind === 'question' || x.replyTo || x.story === 'station' || x.sky || x.kind === 'week' || x.id === 'd0.night' || x.id === 'x.cat1')) {
      expect(s.en, s.id).not.toMatch(/\b(he|him|his)\b/i);
    }
  });
});

describe('the firefly (review 3, ruling 6)', () => {
  it('says only that he is asleep, and tells the person nothing', () => {
    expect(said('hushAsleep')).toEqual({ en: 'Shh. He is asleep.', zh: '嘘，他睡着了。' });
  });
});

describe('postcard letters (review 3, ruling 9)', () => {
  it('have a story of two or three sentences for every terrain', () => {
    for (const terrain of ['city', 'plain', 'hills', 'mountain', 'forest', 'coast', 'lake', 'desert'] as const) {
      const own = storiesFor(terrain).filter((s) => s.terrains);
      expect(own.length, terrain).toBeGreaterThanOrEqual(2);
    }
    for (const s of [...storiesFor('city'), ...storiesFor('city', true)]) {
      const n = s.en.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean).length;
      expect(n, s.id).toBeGreaterThanOrEqual(2);
      expect(n, s.id).toBeLessThanOrEqual(3);
      expect(s.en).toContain('{place}');
      expect(s.zh).toContain('{place}');
    }
    expect(storiesFor('coast', true).every((s) => s.story === 'departure')).toBe(true);
  });

  it('close with the two skies, apart or alike, in either language', () => {
    const apart = skyVars({ hisCond: 'rain', hisTemp: 11.4, yourCond: 'clear', yourTemp: 18 });
    const en = skyLine(apart, 'en', 'C', 'postcard:x')!;
    expect(en).toMatch(/rain/);
    expect(en).toMatch(/sunshine/);
    expect(en).toContain('11°');
    expect(en).toContain('18°');
    const zh = skyLine(apart, 'zh', 'C', 'postcard:x')!;
    expect(zh).toMatch(/雨天/);
    expect(zh).toMatch(/晴天/);
    expect(zh).not.toContain('{');
    const alike = skyLine(skyVars({ hisCond: 'drizzle', hisTemp: 9, yourCond: 'rain', yourTemp: 12 }), 'en', 'C', 'a')!;
    expect(alike).toMatch(/too|as well/);
    expect(skyLine(apart, 'en', 'F', 'postcard:x')).toContain('52°');
  });

  it('say "the same sky" for the place he set out from, and keep quiet when nothing is known', () => {
    expect(skyLine(skyVars({ yourCond: 'overcast', yourTemp: 9, together: true }), 'en', 'C', 'p')).toMatch(/same sky.*grey skies/);
    expect(skyLine(skyVars({ hisCond: 'snow', hisTemp: -2 }), 'en', 'C', 'p')).toBe('Here I had snow, -2°.');
    expect(skyLine(skyVars({ yourCond: 'clear', yourTemp: 20 }), 'en', 'C', 'p')).toBeNull();
    expect(skyLine({}, 'zh', 'C', 'p')).toBeNull();
  });
});
