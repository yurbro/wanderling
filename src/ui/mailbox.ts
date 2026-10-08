import { getLang, t } from '../core/i18n';
import type { LetterKind } from '../core/letters';
import { signoff } from './signoff';

/** A letter as the box shows it: already in the right language. */
export interface ShownLetter {
  id: string;
  kind: LetterKind;
  at: number;
  read: boolean;
  /** The letter's lines; a digest has one per folded letter. */
  lines: string[];
}

export interface Mailbox {
  open(): void;
  close(): void;
  setLetters(letters: ShownLetter[]): void;
  readonly isOpen: boolean;
}

const KIND_KEY: Record<LetterKind, 'kindPostcard' | 'kindMoment' | 'kindWeather' | 'kindSky' | 'kindMissed' | 'kindQuestion' | 'digestTitle'> = {
  postcard: 'kindPostcard',
  moment: 'kindMoment',
  weather: 'kindWeather',
  sky: 'kindSky',
  missed: 'kindMissed',
  question: 'kindQuestion',
  digest: 'digestTitle',
};

/**
 * The letter box: a full-screen overlay like the album, the letters stacked
 * newest first as small sheets of paper. Opening it reads everything.
 */
export function createMailbox(root: HTMLElement, onOpen?: () => void, nameOf: () => string | null = () => null): Mailbox {
  const el = document.createElement('div');
  el.className = 'album mailbox';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('mail')}</div>
        <button class="pill album-close" type="button">${t('close')}</button>
      </div>
      <div class="album-list letter-list" id="mail-list"></div>
      <p class="album-empty" id="mail-empty">${t('noMail')}</p>
    </div>
  `;
  root.appendChild(el);

  const list = el.querySelector<HTMLDivElement>('#mail-list')!;
  const empty = el.querySelector<HTMLParagraphElement>('#mail-empty')!;
  const closeBtn = el.querySelector<HTMLButtonElement>('.album-close')!;
  const dateFmt = new Intl.DateTimeFormat(getLang() === 'zh' ? 'zh-CN' : undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const api: Mailbox = {
    open() {
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('open'));
      onOpen?.();
    },
    close() {
      el.classList.remove('open');
      window.setTimeout(() => {
        if (!el.classList.contains('open')) el.hidden = true;
      }, 350);
    },
    setLetters(letters) {
      list.replaceChildren(...letters.map((l) => renderLetter(l, dateFmt, nameOf())));
      empty.hidden = letters.length > 0;
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

function renderLetter(l: ShownLetter, dateFmt: Intl.DateTimeFormat, name: string | null): HTMLElement {
  const article = document.createElement('article');
  article.className = 'letter' + (l.read ? '' : ' letter-unread') + (l.kind === 'digest' ? ' letter-digest' : '');
  const body = l.lines.map((line) => `<p class="letter-line">${escapeHtml(line)}</p>`).join('');
  article.innerHTML = `
    <div class="letter-meta"><span>${t(KIND_KEY[l.kind])}</span><span>${dateFmt.format(new Date(l.at))}</span></div>
    ${body}
    ${l.kind === 'postcard' ? signoff(name) : ''}
  `;
  return article;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
