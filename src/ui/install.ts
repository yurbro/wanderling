import { t } from '../core/i18n';
import { installHint } from '../core/install';

/**
 * The add-to-home-screen hint. On iOS Safari it explains the Share menu; on
 * browsers with an install prompt it offers a button. Shown from the second
 * visit (or after 45 s), dismissed for good with one tap.
 */

const VISITS_KEY = 'wanderling.visits';
const DISMISS_KEY = 'wanderling.installHint';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupInstallHint(root: HTMLElement): void {
  const visits = bumpVisits();
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    // Treat as not dismissed.
  }
  if (standalone || dismissed) return;

  let promptEvent: BeforeInstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvent = e as BeforeInstallPromptEvent;
    check();
  });

  const started = Date.now();
  let shown = false;
  const check = (): void => {
    if (shown) return;
    const hint = installHint(
      { userAgent: navigator.userAgent, standalone, visits, secondsHere: (Date.now() - started) / 1000, dismissed },
      promptEvent !== null,
    );
    if (hint === 'none') return;
    shown = true;
    show(root, hint, () => promptEvent);
  };
  check();
  const timer = window.setInterval(() => {
    check();
    if (shown) window.clearInterval(timer);
  }, 5000);
}

function show(root: HTMLElement, kind: 'ios' | 'prompt', getPrompt: () => BeforeInstallPromptEvent | null): void {
  const el = document.createElement('div');
  el.className = 'install';
  el.innerHTML =
    kind === 'ios'
      ? `<div class="install-text"><b>${t('keepSky')}</b> ${t('iosHint')}</div>
         <button class="pill install-close" type="button">${t('gotIt')}</button>`
      : `<div class="install-text"><b>${t('keepSky')}</b> ${t('promptHint')}</div>
         <button class="pill install-go" type="button">${t('add')}</button>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const dismiss = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Fine.
    }
    el.classList.remove('show');
    window.setTimeout(() => el.remove(), 500);
  };
  el.querySelector('.install-close')?.addEventListener('click', dismiss);
  el.querySelector('.install-go')?.addEventListener('click', async () => {
    const p = getPrompt();
    if (p) {
      await p.prompt();
      await p.userChoice.catch(() => undefined);
    }
    dismiss();
  });
  // Tapping the scene instead also puts it away for this visit, not for good.
  window.setTimeout(() => {
    const away = (): void => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 500);
      document.removeEventListener('pointerdown', onTap, true);
    };
    const onTap = (e: Event): void => {
      if (!el.contains(e.target as Node)) away();
    };
    document.addEventListener('pointerdown', onTap, true);
  }, 1000);
}

function bumpVisits(): number {
  try {
    const n = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
    localStorage.setItem(VISITS_KEY, String(n));
    return n;
  } catch {
    return 1;
  }
}
