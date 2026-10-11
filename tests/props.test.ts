import { describe, expect, it } from 'vitest';
import { MAX_SAME_PROP, pickProp, propLimit } from '../src/core/props';

describe('roadside prop density (ruling 17)', () => {
  it('lets two of a kind stand in view and no more', () => {
    expect(MAX_SAME_PROP).toBe(2);
    expect(pickProp(['bench'], { bench: 1 }, 0.5)).toBe('bench');
    expect(pickProp(['bench'], { bench: 2 }, 0.5)).toBeNull();
  });

  it('keeps the postbox to one, and picks among what is left', () => {
    expect(propLimit('postbox')).toBe(1);
    expect(pickProp(['bench', 'postbox'], { postbox: 1 }, 0.9)).toBe('bench');
    expect(pickProp(['bench', 'postbox'], { bench: 2, postbox: 1 }, 0.1)).toBeNull();
    expect(pickProp(['bench', 'postbox'], {}, 0.1)).toBe('bench');
    expect(pickProp(['bench', 'postbox'], {}, 0.9)).toBe('postbox');
  });

  it('never fills a town with benches however the dice fall', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      const p = pickProp(['bench', 'postbox'], counts, (i * 0.37) % 1);
      if (p) counts[p] = (counts[p] ?? 0) + 1;
    }
    expect(counts).toEqual({ bench: 2, postbox: 1 });
  });
});

describe('detailKind', () => {
  it('gives each terrain its own odds, summing to one', async () => {
    const { DETAIL_MIX, detailKind } = await import('../src/core/props');
    for (const [terrain, mix] of Object.entries(DETAIL_MIX)) {
      const sum = mix.extra + mix.tuft + mix.stone + mix.flower;
      expect(Math.abs(sum - 1), terrain).toBeLessThan(1e-9);
    }
    // A desert is mostly stones; a plain mostly grass; the hills have nothing of their own.
    const count = (terrain: 'desert' | 'plain' | 'hills', kind: string): number => {
      let n = 0;
      for (let i = 0; i < 1000; i++) if (detailKind(terrain, (i + 0.5) / 1000) === kind) n++;
      return n;
    };
    expect(count('desert', 'stone')).toBeGreaterThan(count('desert', 'tuft'));
    expect(count('plain', 'tuft')).toBeGreaterThan(count('plain', 'stone'));
    expect(count('hills', 'extra')).toBe(0);
    expect(detailKind('hills', 0.999)).toBe('flower');
  });
});
