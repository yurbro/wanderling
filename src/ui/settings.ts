import { cleanName, NAME_MAX } from '../core/name';
import { t } from '../core/i18n';

export interface SettingsHooks {
  /** The name now, or null before he has one. */
  getName: () => string | null;
  /** A new name, already cleaned. */
  onRename: (name: string) => void;
  /** The place name shown under "where you are". */
  getPlace: () => string;
  /** Ask the phone for its place; resolves false when it could not be had. */
  onLocate: () => Promise<boolean>;
  onPickCity: () => void;
  onLanguage: () => void;
  /** The motion row: null when the phone has no motion sensors. */
  motion: { isOn: () => boolean; set: (on: boolean) => Promise<boolean> } | null;
}

export interface Settings {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

/**
 * The settings sheet (decisions section 9, ruling 15): his name, the city and
 * location, the language, and the motion switch. Same paper as the album.
 */
export function createSettings(root: HTMLElement, hooks: SettingsHooks): Settings {
  const el = document.createElement('div');
  el.className = 'album settings';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('settings')}</div>
        <button class="pill settings-close" type="button">${t('close')}</button>
      </div>
      <form class="settings-row" id="set-name-form">
        <label class="settings-label" for="set-name">${t('settingsName')}</label>
        <div class="settings-line">
          <input class="city-input" id="set-name" type="text" maxlength="${NAME_MAX * 2}" autocomplete="off" autocapitalize="words" spellcheck="false" />
          <button class="pill" type="submit" id="set-name-save">${t('save')}</button>
        </div>
      </form>
      <div class="settings-row">
        <div class="settings-label">${t('settingsPlace')}</div>
        <div class="settings-value" id="set-place"></div>
        <div class="settings-line">
          <button class="pill" type="button" id="set-locate">${t('useLocation')}</button>
          <button class="pill" type="button" id="set-city">${t('pickCity')}</button>
        </div>
        <p class="settings-note" id="set-place-note"></p>
      </div>
      <div class="settings-row">
        <div class="settings-label">${t('settingsLang')}</div>
        <div class="settings-line">
          <button class="pill" type="button" id="set-lang">${t('language')}</button>
        </div>
      </div>
      <div class="settings-row" id="set-motion-row" hidden>
        <div class="settings-label">${t('settingsMotion')}</div>
        <div class="settings-line">
          <button class="pill" type="button" id="set-motion" role="switch" aria-checked="false"></button>
        </div>
        <p class="settings-note" id="set-motion-note">${t('settingsMotionNote')}</p>
      </div>
    </div>
  `;
  root.appendChild(el);
  const q = <T extends HTMLElement>(sel: string): T => el.querySelector<T>(sel)!;
  const nameForm = q<HTMLFormElement>('#set-name-form');
  const nameInput = q<HTMLInputElement>('#set-name');
  const nameSave = q<HTMLButtonElement>('#set-name-save');
  const placeValue = q<HTMLDivElement>('#set-place');
  const placeNote = q<HTMLParagraphElement>('#set-place-note');
  const locateBtn = q<HTMLButtonElement>('#set-locate');
  const motionRow = q<HTMLDivElement>('#set-motion-row');
  const motionBtn = q<HTMLButtonElement>('#set-motion');
  const motionNote = q<HTMLParagraphElement>('#set-motion-note');

  const paintMotion = (): void => {
    const on = hooks.motion?.isOn() ?? false;
    motionBtn.textContent = on ? t('on') : t('off');
    motionBtn.setAttribute('aria-checked', String(on));
    motionBtn.classList.toggle('is-on', on);
  };
  const refresh = (): void => {
    nameInput.value = hooks.getName() ?? '';
    placeValue.textContent = hooks.getPlace();
    placeNote.textContent = '';
    nameSave.textContent = t('save');
    motionRow.hidden = !hooks.motion;
    paintMotion();
  };

  const api: Settings = {
    open() {
      refresh();
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('open'));
    },
    close() {
      el.classList.remove('open');
      window.setTimeout(() => {
        if (!el.classList.contains('open')) el.hidden = true;
      }, 350);
    },
    get isOpen() {
      return !el.hidden;
    },
  };

  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(nameInput.value);
    if (!name) return;
    nameInput.value = name;
    hooks.onRename(name);
    nameSave.textContent = t('saved');
    nameInput.blur();
  });
  nameInput.addEventListener('input', () => (nameSave.textContent = t('save')));

  locateBtn.addEventListener('click', async () => {
    locateBtn.disabled = true;
    locateBtn.textContent = t('finding');
    placeNote.textContent = '';
    try {
      const ok = await hooks.onLocate();
      placeValue.textContent = hooks.getPlace();
      if (!ok) placeNote.textContent = t('noLocation');
    } finally {
      locateBtn.disabled = false;
      locateBtn.textContent = t('useLocation');
    }
  });
  q<HTMLButtonElement>('#set-city').addEventListener('click', () => {
    api.close();
    hooks.onPickCity();
  });
  q<HTMLButtonElement>('#set-lang').addEventListener('click', () => hooks.onLanguage());
  motionBtn.addEventListener('click', async () => {
    if (!hooks.motion) return;
    const wantOn = !hooks.motion.isOn();
    motionBtn.disabled = true;
    try {
      const on = await hooks.motion.set(wantOn);
      motionNote.textContent = wantOn && !on ? t('motionDenied') : t('settingsMotionNote');
    } finally {
      motionBtn.disabled = false;
      paintMotion();
    }
  });
  q<HTMLButtonElement>('.settings-close').addEventListener('click', () => api.close());
  el.addEventListener('click', (e) => {
    if (e.target === el) api.close();
  });
  return api;
}
