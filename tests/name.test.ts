import { describe, expect, it } from 'vitest';
import { NAME_CHOICES, NAME_MAX, cleanName, nameOrPick, pickName } from '../src/core/name';
import { isLeafFall, shouldAskMotion, type AskContext } from '../src/core/motionAsk';

describe('naming him', () => {
  it('keeps a plain name as it is', () => {
    expect(cleanName('Biscuit')).toBe('Biscuit');
    expect(cleanName('小满')).toBe('小满');
  });

  it('trims, flattens spaces and drops markup and control characters', () => {
    expect(cleanName('  Mr   Moss ')).toBe('Mr Moss');
    expect(cleanName('<b>Pip</b>')).toBe('b Pip /b');
    expect(cleanName('a\u0000b\nc')).toBe('a b c');
  });

  it('caps the length by letters, not by code units', () => {
    expect(Array.from(cleanName('x'.repeat(40))).length).toBe(NAME_MAX);
    expect(Array.from(cleanName('🌿'.repeat(20))).length).toBe(NAME_MAX);
  });

  it('picks one of the four, whatever the random number', () => {
    expect(NAME_CHOICES).toEqual(['Pip', 'Moss', 'Tumble', 'Fennel']);
    expect(pickName(0)).toBe('Pip');
    expect(pickName(0.99)).toBe('Fennel');
    expect(pickName(1)).toBe('Fennel');
    expect(pickName(-3)).toBe('Pip');
  });

  it('falls back to a pick when nothing usable was typed', () => {
    expect(nameOrPick('   ', 0.3)).toBe('Moss');
    expect(nameOrPick('Ada', 0.3)).toBe('Ada');
  });
});

describe('when to ask for motion', () => {
  const day = 86_400_000;
  const base: AskContext = { now: Date.UTC(2026, 9, 20, 12), startedAt: Date.UTC(2026, 9, 1), visible: true, lat: 51, condition: 'clear', settled: false };

  it('knows the leaf-fall months by hemisphere', () => {
    expect(isLeafFall(new Date(2026, 9, 20), 51)).toBe(true);
    expect(isLeafFall(new Date(2026, 6, 20), 51)).toBe(false);
    expect(isLeafFall(new Date(2026, 9, 20), -33)).toBe(false);
    expect(isLeafFall(new Date(2026, 3, 20), -33)).toBe(true);
  });

  it('asks in leaf-fall, or in snow, once a day has passed', () => {
    expect(shouldAskMotion(base)).toBe(true);
    expect(shouldAskMotion({ ...base, now: Date.UTC(2026, 0, 20, 12), startedAt: Date.UTC(2026, 0, 1), condition: 'snow' })).toBe(true);
    expect(shouldAskMotion({ ...base, now: Date.UTC(2026, 6, 20, 12), startedAt: Date.UTC(2026, 6, 1) })).toBe(false);
  });

  it('never asks on the first day', () => {
    expect(shouldAskMotion({ ...base, startedAt: base.now - day + 60_000 })).toBe(false);
    expect(shouldAskMotion({ ...base, startedAt: null })).toBe(false);
  });

  it('only asks while the app is open, and only until it is settled', () => {
    expect(shouldAskMotion({ ...base, visible: false })).toBe(false);
    expect(shouldAskMotion({ ...base, settled: true })).toBe(false);
  });
});
