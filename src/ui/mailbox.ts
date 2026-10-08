import { getLang, t } from '../core/i18n';
import type { LetterKind } from '../core/letters';
import type { SkyPanel } from '../core/script';
import { signoff } from './signoff';

/** A letter as the box shows it: already in the right language. */
export interface ShownLetter {
  id: string;
  kind: LetterKind;
  at: number;
  read: boolean;
  /** The letter's lines; a digest has one per folded letter. */
  lines: string[];
  /** A question's answers, already in the right language. */
  options?: { id: string; label: string }[];
  /** The answer given, if any. */
  chosen?: string;
  /** The reply has gone: the answers are kept, but tapping changes nothing. */
  settled?: boolean;
  /** The week of sky: seven squares of the person's sky. */
  panels?: SkyPanel[];
  /** Under the week of sky: the days' short names. */
  panelDays?: string[];
}

export interface Mailbox {
  open(): void;
  close(): void;
  setLetters(letters: ShownLetter[]): void;
  /** The line about his pack at the top of the box; null hides it (never a word about it being empty). */
  setPack(text: string | null): void;
  readonly isOpen: boolean;
}

export interface MailboxOptions {
  onOpen?: () => void;
  nameOf?: () => string | null;
  /** The person picked an answer to one of his questions. */
  onAnswer?: (letterId: string, option: string) => void;
}

const KIND_KEY: Record<LetterKind, 'kindPostcard' | 'kindMoment' | 'kindWeather' | 'kindSky' | 'kindMissed' | 'kindQuestion' | 'kindWeek' | 'digestTitle'> = {
  postcard: 'kindPostcard',
  moment: 'kindMoment',
  weather: 'kindWeather',
  sky: 'kindSky',
  missed: 'kindMissed',
  question: 'kindQuestion',
  week: 'kindWeek',
  digest: 'digestTitle',
};

/**
 * The letter box: a full-screen overlay like the album, the letters stacked
 * newest first as small sheets of paper. Opening it reads everything.
 */
export function createMailbox(root: HTMLElement, opts: MailboxOptions = {}): Mailbox {
  const { onOpen, onAnswer } = opts;
  const nameOf = opts.nameOf ?? (() => null);
  const el = document.createElement('div');
  el.className = 'album mailbox';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('mail')}</div>
        <button class="pill album-close" type="button">${t('close')}</button>
      </div>
      <p class="pack-line" id="mail-pack" hidden></p>
      <div class="album-list letter-list" id="mail-list"></div>
      <p class="album-empty" id="mail-empty">${t('noMail')}</p>
    </div>
  `;
  root.appendChild(el);

  const list = el.querySelector<HTMLDivElement>('#mail-list')!;
  const empty = el.querySelector<HTMLParagraphElement>('#mail-empty')!;
  const pack = el.querySelector<HTMLParagraphElement>('#mail-pack')!;
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
    setPack(text) {
      pack.textContent = text ?? '';
      pack.hidden = !text;
    },
    get isOpen() {
      return !el.hidden;
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  // An answer: one tap on one of the options under a question.
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.answer');
    if (!btn || btn.disabled) return;
    const letter = btn.closest<HTMLElement>('.letter');
    if (letter?.dataset.id && btn.dataset.option) onAnswer?.(letter.dataset.id, btn.dataset.option);
  });
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
  article.dataset.id = l.id;
  const body = l.lines.map((line) => `<p class="letter-line">${escapeHtml(line)}</p>`).join('');
  const answers = l.options?.length
    ? `<div class="answers${l.chosen ? ' answered' : ''}${l.settled ? ' settled' : ''}">${l.options
        .map((o) => {
          const chosen = o.id === l.chosen;
          // Until the reply has gone the answer can still change; after, it is kept as it was.
          const disabled = l.settled || chosen;
          return `<button type="button" class="answer${chosen ? ' chosen' : ''}" data-option="${escapeHtml(o.id)}"${disabled ? ' disabled' : ''}>${escapeHtml(o.label)}</button>`;
        })
        .join('')}</div>`
    : '';
  const week = l.panels?.length
    ? `<div class="week-sky">${l.panels
        .map((p, i) => {
          const top = '#' + p.top.toString(16).padStart(6, '0');
          const horizon = '#' + p.horizon.toString(16).padStart(6, '0');
          return `<figure class="week-day"><div class="week-square" style="background:linear-gradient(${top},${horizon})"><span>${glyph(p.condition)}</span></div><figcaption>${escapeHtml(l.panelDays?.[i] ?? '')}</figcaption></figure>`;
        })
        .join('')}</div>`
    : '';
  const signed = l.kind === 'postcard' || l.kind === 'week';
  article.innerHTML = `
    <div class="letter-meta"><span>${t(KIND_KEY[l.kind])}</span><span>${dateFmt.format(new Date(l.at))}</span></div>
    ${body}
    ${week}
    ${answers}
    ${signed ? signoff(name) : ''}
  `;
  return article;
}

/** A small mark for the day's weather in the week of sky; a clear day has none. */
function glyph(c: SkyPanel['condition']): string {
  switch (c) {
    case 'partly-cloudy':
    case 'overcast':
    case 'fog':
      return '☁';
    case 'drizzle':
    case 'rain':
    case 'heavy-rain':
    case 'thunderstorm':
      return '☂';
    case 'snow':
    case 'heavy-snow':
      return '❄';
    default:
      return '';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
