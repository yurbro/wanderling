import type { CityResult } from '../core/geo';
import { t } from '../core/i18n';

export interface CityChooser {
  open(): void;
  close(): void;
}

/**
 * "Where are you?": a small sheet with a text field. Results come from the
 * city search; picking one sets the location. Used when location sharing is
 * declined, or to try the sky somewhere else.
 */
export function createCityChooser(
  root: HTMLElement,
  search: (query: string) => Promise<CityResult[]>,
  onPick: (city: CityResult) => void,
): CityChooser {
  const el = document.createElement('div');
  el.className = 'album city-sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('whereAreYou')}</div>
        <button class="pill city-close" type="button">${t('close')}</button>
      </div>
      <form class="city-form" id="city-form">
        <input class="city-input" id="city-input" type="search" placeholder="${t('typeCity')}" autocomplete="off" autocapitalize="words" />
        <button class="pill" type="submit">${t('search')}</button>
      </form>
      <ul class="city-results" id="city-results"></ul>
      <p class="city-note" id="city-note">${t('cityNote')}</p>
    </div>
  `;
  root.appendChild(el);
  const form = el.querySelector<HTMLFormElement>('#city-form')!;
  const input = el.querySelector<HTMLInputElement>('#city-input')!;
  const results = el.querySelector<HTMLUListElement>('#city-results')!;
  const note = el.querySelector<HTMLParagraphElement>('#city-note')!;
  const closeBtn = el.querySelector<HTMLButtonElement>('.city-close')!;

  const api: CityChooser = {
    open() {
      el.hidden = false;
      requestAnimationFrame(() => {
        el.classList.add('open');
        input.focus();
      });
    },
    close() {
      el.classList.remove('open');
      window.setTimeout(() => {
        if (!el.classList.contains('open')) el.hidden = true;
      }, 350);
    },
  };

  let seq = 0;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) return;
    const my = ++seq;
    note.textContent = t('looking');
    results.replaceChildren();
    const found = await search(q);
    if (my !== seq) return;
    if (found.length === 0) {
      note.textContent = t('noPlace');
      return;
    }
    note.textContent = '';
    results.replaceChildren(
      ...found.map((c) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'city-result';
        btn.innerHTML = `<span class="city-name"></span><span class="city-region"></span>`;
        btn.querySelector('.city-name')!.textContent = c.name;
        btn.querySelector('.city-region')!.textContent = c.region ?? '';
        btn.addEventListener('click', () => {
          onPick(c);
          api.close();
        });
        li.appendChild(btn);
        return li;
      }),
    );
  });

  closeBtn.addEventListener('click', () => api.close());
  el.addEventListener('click', (e) => {
    if (e.target === el) api.close();
  });
  return api;
}
