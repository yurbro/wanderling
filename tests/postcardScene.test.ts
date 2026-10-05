import { describe, expect, it } from 'vitest';
import { makePostcard } from '../src/core/postcards';
import { demoWeather } from '../src/core/weather';
import { TO_THE_SEA } from '../src/data/routes';
import { renderPostcardScene } from '../src/ui/postcardScene';

const LONDON = { lat: 51.51, lon: -0.13 };
const noon = Date.UTC(2026, 5, 21, 12, 0, 0);
const midnight = Date.UTC(2026, 0, 2, 0, 30, 0);

describe('renderPostcardScene', () => {
  it('draws a sun by day, a moon and stars by night, rain when it rained, sea at the coast', () => {
    const day = renderPostcardScene(makePostcard(TO_THE_SEA, { placeId: 'box-hill', at: noon }, LONDON, null)!);
    expect(day).toContain('<svg');
    expect(day).toContain('r="11"');
    expect(day).not.toContain('r="9"');
    const night = renderPostcardScene(makePostcard(TO_THE_SEA, { placeId: 'box-hill', at: midnight }, LONDON, demoWeather('clear', new Date(midnight)))!);
    expect(night).toContain('r="9"');
    expect((night.match(/<circle/g) ?? []).length).toBeGreaterThan(30);
    const wet = renderPostcardScene(makePostcard(TO_THE_SEA, { placeId: 'brighton', at: noon }, LONDON, demoWeather('rain', new Date(noon)))!);
    expect((wet.match(/<line x1/g) ?? []).length).toBe(55);
    expect(wet).toContain('q5 -2 10 0');
  });

  it('is deterministic per card and copes with cards from before the sky was stored', () => {
    const card = makePostcard(TO_THE_SEA, { placeId: 'london', at: noon }, LONDON, null)!;
    expect(renderPostcardScene(card)).toBe(renderPostcardScene(card));
    const { sky, ...old } = card;
    void sky;
    expect(renderPostcardScene(old as typeof card)).toContain('<svg');
  });
});
