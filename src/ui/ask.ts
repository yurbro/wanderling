import { t } from '../core/i18n';

/**
 * A light, one-time question at the foot of the screen (the motion sensors).
 * Looks like the home-screen hint. Resolves true for "allow" and false for
 * "no thanks"; the tap on "allow" is the gesture iOS needs for its own prompt,
 * so the caller asks the system from inside `onYes`.
 */
export function askLightly(root: HTMLElement, text: string, onYes: () => Promise<void>): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'install ask';
    el.innerHTML = `
      <div class="install-text">${text}</div>
      <div class="ask-buttons">
        <button class="pill ask-yes" type="button">${t('askYes')}</button>
        <button class="pill ask-no" type="button">${t('askNo')}</button>
      </div>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const close = (answer: boolean): void => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 500);
      resolve(answer);
    };
    el.querySelector('.ask-yes')!.addEventListener('click', () => {
      // The system's own prompt follows at once, still inside this tap.
      void onYes().finally(() => close(true));
    });
    el.querySelector('.ask-no')!.addEventListener('click', () => close(false));
  });
}
