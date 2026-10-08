/**
 * His signature at the foot of a postcard or letter: a small footprint and
 * his name in a handwriting face (Caveat, SIL Open Font License; Chinese names
 * fall back to the phone's own brush-style font). The name is escaped here.
 */

const FOOTPRINT = `<svg class="footprint" viewBox="0 0 20 26" width="14" height="18" aria-hidden="true" focusable="false">
  <ellipse cx="10" cy="9" rx="6.2" ry="8"/>
  <ellipse cx="10" cy="21.5" rx="4.4" ry="3.6"/>
</svg>`;

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** The signature line's HTML, or nothing when he has no name yet. */
export function signoff(name: string | null): string {
  if (!name) return '';
  return `<div class="signoff">${FOOTPRINT}<span class="signoff-name">${escapeHtml(name)}</span></div>`;
}
