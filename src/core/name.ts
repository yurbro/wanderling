/**
 * The wanderling's name (decisions D7): the person names him, or lets him be
 * Pip, Moss, Tumble or Fennel. Pure rules only; the saving lives in
 * src/data/nameStore.ts.
 */

export const NAME_CHOICES = ['Pip', 'Moss', 'Tumble', 'Fennel'] as const;
export const NAME_MAX = 12;

/** What a typed name becomes: no markup, no control characters, one space between words, at most 12 letters. */
export function cleanName(raw: string): string {
  const flat = raw
    .replace(/[\u0000-\u001f\u007f<>&"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(flat).slice(0, NAME_MAX).join('').trim();
}

/** One of the four, for "you choose" and for a skipped introduction. `r` is a random number in [0, 1). */
export function pickName(r: number = Math.random()): string {
  const i = Math.min(NAME_CHOICES.length - 1, Math.max(0, Math.floor(r * NAME_CHOICES.length)));
  return NAME_CHOICES[i];
}

/** The typed name when it is usable, else a pick. */
export function nameOrPick(raw: string, r?: number): string {
  return cleanName(raw) || pickName(r);
}
