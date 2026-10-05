import { hexToCss } from '../core/color';
import { getLang, t } from '../core/i18n';
import { describeArrival, stampGlyph } from '../core/postcards';
import type { Postcard } from '../core/types';

export interface Album {
  open(): void;
  close(): void;
  setCards(cards: Postcard[]): void;
  readonly isOpen: boolean;
}

/**
 * The postcard album: a full-screen overlay with the cards stacked newest
 * first. Each card is plain DOM, its little landscape painted with the
 * colors captured at arrival.
 */
export function createAlbum(root: HTMLElement, unit: 'C' | 'F'): Album {
  const el = document.createElement('div');
  el.className = 'album';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('postcards')}</div>
        <button class="pill album-close" type="button">${t('close')}</button>
      </div>
      <div class="album-list" id="album-list"></div>
      <p class="album-empty" id="album-empty">${t('noPostcards')}</p>
    </div>
  `;
  root.appendChild(el);

  const list = el.querySelector<HTMLDivElement>('#album-list')!;
  const empty = el.querySelector<HTMLParagraphElement>('#album-empty')!;
  const closeBtn = el.querySelector<HTMLButtonElement>('.album-close')!;
  const dateFmt = new Intl.DateTimeFormat(getLang() === 'zh' ? 'zh-CN' : undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const api: Album = {
    open() {
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('open'));
    },
    close() {
      el.classList.remove('open');
      window.setTimeout(() => {
        if (!el.classList.contains('open')) el.hidden = true;
      }, 350);
    },
    setCards(cards) {
      list.replaceChildren(...[...cards].reverse().map((c) => renderCard(c, unit, dateFmt)));
      empty.hidden = cards.length > 0;
    },
    get isOpen() {
      return !el.hidden;
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  el.addEventListener('click', (e) => {
    if (e.target === el) api.close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && api.isOpen) api.close();
  });

  return api;
}

function renderCard(card: Postcard, unit: 'C' | 'F', dateFmt: Intl.DateTimeFormat): HTMLElement {
  const c = card.colors;
  const sea = card.seaAmount;
  const far = sea > 0.5 ? c.sea : c.hillFar;
  const article = document.createElement('article');
  article.className = 'card' + (card.darkInk ? ' card-dark-ink' : '');
  // Layered bands: sky, far hills (or sea), near hills, ground.
  const scene = [
    `${hexToCss(c.skyTop)} 0%`,
    `${hexToCss(c.skyHorizon)} 58%`,
    `${hexToCss(far)} 58%`,
    `${hexToCss(far)} ${sea > 0.5 ? 74 : 70}%`,
    `${hexToCss(c.hillNear)} ${sea > 0.5 ? 74 : 70}%`,
    `${hexToCss(c.hillNear)} 80%`,
    `${hexToCss(c.ground)} 80%`,
    `${hexToCss(c.ground)} 100%`,
  ].join(', ');
  article.innerHTML = `
    <div class="card-scene" style="background: linear-gradient(to bottom, ${scene})">
      <div class="card-stamp">${stampGlyph(card)}</div>
      <div class="card-place">${escapeHtml(card.placeName)}</div>
      ${card.region ? `<div class="card-region">${escapeHtml(card.region)}</div>` : ''}
    </div>
    <div class="card-back">
      <div class="card-date">${dateFmt.format(new Date(card.at))} · ${describeArrival(card, unit)}</div>
      <div class="card-note">${escapeHtml(card.note)}</div>
    </div>
  `;
  return article;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
