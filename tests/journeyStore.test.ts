import { describe, expect, it } from 'vitest';
import { KM_PER_HOUR, REST_MS, startJourney } from '../src/core/journey';
import { isJourneyState, loadJourney, saveJourney } from '../src/data/journeyStore';
import { ROUTES, TO_THE_SEA, routeById } from '../src/data/routes';

function memoryStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('the first route', () => {
  it('is well formed', () => {
    expect(TO_THE_SEA.legs).toHaveLength(TO_THE_SEA.places.length - 1);
    expect(new Set(TO_THE_SEA.places.map((p) => p.id)).size).toBe(TO_THE_SEA.places.length);
    for (const leg of TO_THE_SEA.legs) expect(leg.km).toBeGreaterThan(0);
    expect(routeById(TO_THE_SEA.id)).toBe(TO_THE_SEA);
    expect(routeById('nope')).toBeUndefined();
  });

  it('is walked at the pace the design asks for: a new place every 2 to 3 days (D10)', () => {
    const H = 3_600_000;
    const legs = ROUTES.flatMap((r) => r.legs).filter((l) => (l.mode ?? 'walk') === 'walk');
    const hoursPerStop = legs.map((l) => l.km / KM_PER_HOUR + REST_MS / H);
    const mean = hoursPerStop.reduce((a, b) => a + b, 0) / hoursPerStop.length;
    expect(mean).toBeGreaterThanOrEqual(2 * 24);
    expect(mean).toBeLessThanOrEqual(3 * 24);
    // Even the shortest leg takes most of a day; the longest well under a week.
    expect(Math.min(...hoursPerStop)).toBeGreaterThan(18);
    expect(Math.max(...hoursPerStop)).toBeLessThan(7 * 24);
  });
});

describe('journey store', () => {
  it('round-trips a journey', () => {
    const storage = memoryStorage();
    const s = startJourney(TO_THE_SEA, 1_000_000);
    saveJourney(s, storage);
    expect(loadJourney(storage)).toEqual(s);
  });

  it('rejects garbage and missing entries', () => {
    const storage = memoryStorage();
    expect(loadJourney(storage)).toBeNull();
    storage.setItem('wanderling.journey', '{"routeId":1}');
    expect(loadJourney(storage)).toBeNull();
    storage.setItem('wanderling.journey', 'not json');
    expect(loadJourney(storage)).toBeNull();
    expect(loadJourney(null)).toBeNull();
  });

  it('validates the shape strictly', () => {
    const s = startJourney(TO_THE_SEA, 5);
    expect(isJourneyState(s)).toBe(true);
    expect(isJourneyState({ ...s, arrivals: [{ placeId: 3, at: 1 }] })).toBe(false);
    expect(isJourneyState({ ...s, restingUntil: 'soon' })).toBe(false);
    expect(isJourneyState(null)).toBe(false);
  });
});
