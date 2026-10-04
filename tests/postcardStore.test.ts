import { describe, expect, it } from 'vitest';
import { makePostcard } from '../src/core/postcards';
import { clearPostcards, isPostcard, loadPostcards, savePostcards } from '../src/data/postcardStore';
import { TO_THE_SEA } from '../src/data/routes';

const LONDON = { lat: 51.51, lon: -0.13, name: 'London' };

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('postcard store', () => {
  it('round-trips, filters junk and clears', () => {
    const storage = memoryStorage();
    expect(loadPostcards(storage)).toEqual([]);
    const card = makePostcard(TO_THE_SEA, { placeId: 'london', at: 1_000_000 }, LONDON, null)!;
    savePostcards([card], storage);
    expect(loadPostcards(storage)).toEqual([card]);
    storage.setItem('wanderling.postcards', JSON.stringify([card, { id: 'bad' }, 42]));
    expect(loadPostcards(storage)).toEqual([card]);
    storage.setItem('wanderling.postcards', '{not json');
    expect(loadPostcards(storage)).toEqual([]);
    savePostcards([card], storage);
    clearPostcards(storage);
    expect(loadPostcards(storage)).toEqual([]);
    expect(loadPostcards(null)).toEqual([]);
  });

  it('validates the shape', () => {
    const card = makePostcard(TO_THE_SEA, { placeId: 'brighton', at: 5 }, LONDON, null)!;
    expect(isPostcard(card)).toBe(true);
    expect(isPostcard({ ...card, colors: { skyTop: 1 } })).toBe(false);
    expect(isPostcard({ ...card, at: 'yesterday' })).toBe(false);
    expect(isPostcard(null)).toBe(false);
  });
});
