import { afterEach, describe, expect, it } from 'vitest';
import { detectLang, placeName, placeNote, setLang, t } from '../src/core/i18n';
import { advance, describeJourney, locate, startJourney } from '../src/core/journey';
import { describeArrival, makePostcard } from '../src/core/postcards';
import { demoWeather } from '../src/core/weather';
import { ROUTES, TO_THE_SEA } from '../src/data/routes';

afterEach(() => setLang('en'));

describe('i18n', () => {
  it('detects the language from a saved choice, then the browser', () => {
    expect(detectLang('zh', 'en-US')).toBe('zh');
    expect(detectLang(null, 'zh-CN')).toBe('zh');
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang('fr', 'fr-FR')).toBe('en');
  });

  it('fills slots and switches language', () => {
    expect(t('kmToGo', { km: 12 })).toBe('12 km to go');
    setLang('zh');
    expect(t('kmToGo', { km: 12 })).toBe('还有 12 公里');
    expect(t('restingIn', { name: '伦敦' })).toBe('在伦敦歇脚');
  });

  it('every bundled place has a Chinese name and line', () => {
    for (const r of ROUTES) {
      expect(r.nameZh, r.id).toBeTruthy();
      for (const p of r.places) {
        expect(p.zh?.name, `${r.id}/${p.id}`).toBeTruthy();
        expect(p.zh?.note, `${r.id}/${p.id}`).toBeTruthy();
        expect(p.zh?.note).not.toMatch(/—/);
      }
    }
  });

  it('journey lines, postcards and captions come out in Chinese', () => {
    setLang('zh');
    const t0 = new Date(2026, 9, 4, 15, 0).getTime();
    const s = advance(TO_THE_SEA, startJourney(TO_THE_SEA, t0), t0 + 3_600_000).state;
    expect(describeJourney(locate(TO_THE_SEA, s, t0 + 3_600_000))).toBe('走向里士满公园 · 还有 7 公里');
    expect(placeName(TO_THE_SEA.places[0])).toBe('伦敦');
    expect(placeNote(TO_THE_SEA.places[0])).toBe('鞋带系好。出发。');
    const card = makePostcard(TO_THE_SEA, { placeId: 'brighton', at: t0 }, { lat: 51.51, lon: -0.13 }, demoWeather('rain', new Date(t0), { temperature: 11 }))!;
    expect(card.placeName).toBe('布莱顿');
    expect(describeArrival(card)).toBe('下着雨的下午 · 11°');
  });
});
