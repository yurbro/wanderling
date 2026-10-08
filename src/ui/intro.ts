import { nameOrPick, pickName } from '../core/name';
import { t } from '../core/i18n';

/**
 * The first minute (decisions D7; docs/design/review-v2.md section 4):
 * the sky and one line, the backpack rolling in, a name, and off he goes.
 * New people get all of it; someone who already has a journey but no name
 * gets only the naming. Everything can be skipped, and he is then simply
 * given one of the four names.
 */

export interface IntroHooks {
  /** Ask where the person is (one system prompt) and move the sky there; resolves either way. */
  matchSky(): Promise<void>;
  /** The backpack rolls in and he climbs out of it. */
  arrive(): Promise<void>;
  /** Let him walk. */
  release(): void;
}

const ABORT = Symbol('skipped');

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Runs the introduction; resolves with the name he ends up with. */
export function runIntro(root: HTMLElement, mode: 'full' | 'name', hooks: IntroHooks): Promise<string> {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `
    <button class="intro-skip" type="button">${t('introSkip')}</button>
    <div class="intro-sky" hidden>
      <p class="intro-look">${t('introLook')}</p>
      <p class="intro-why">${t('introWhy')}</p>
      <div class="intro-actions">
        <button class="pill" id="intro-match" type="button">${t('introMatch')}</button>
        <button class="pill" id="intro-later" type="button">${t('introNotNow')}</button>
      </div>
    </div>
    <form class="intro-name" hidden>
      <p class="intro-look">${t('introNoName')}</p>
      <input class="intro-input" type="text" enterkeyhint="done" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="24" placeholder="${t('introNameHint')}" aria-label="${t('introNameHint')}" />
      <div class="intro-actions">
        <button class="pill" type="submit">${t('introNameOk')}</button>
        <button class="pill" id="intro-choose" type="button">${t('introYouChoose')}</button>
      </div>
    </form>
    <p class="intro-speech" aria-live="polite"></p>
  `;
  root.classList.add('in-intro');
  root.appendChild(el);

  const q = <T extends HTMLElement>(sel: string): T => el.querySelector<T>(sel)!;
  const skipBtn = q<HTMLButtonElement>('.intro-skip');
  const skySection = q<HTMLDivElement>('.intro-sky');
  const why = q<HTMLElement>('.intro-why');
  const skyActions = q<HTMLDivElement>('.intro-sky .intro-actions');
  const form = q<HTMLFormElement>('.intro-name');
  const input = q<HTMLInputElement>('.intro-input');
  const speech = q<HTMLParagraphElement>('.intro-speech');

  let aborted = false;
  const skipped = new Promise<void>((r) => skipBtn.addEventListener('click', () => ((aborted = true), r())));
  /** Wait for something, but give up at once when the person skips. */
  const step = async <T>(p: Promise<T>): Promise<T> => {
    const v = await Promise.race([p, skipped.then(() => undefined as unknown as T)]);
    if (aborted) throw ABORT;
    return v;
  };
  const show = (n: Element): void => {
    (n as HTMLElement).hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('shown')));
  };
  const hide = async (n: Element): Promise<void> => {
    n.classList.remove('shown');
    await step(sleep(500));
    (n as HTMLElement).hidden = true;
  };
  const say = async (line: string, ms = 2400): Promise<void> => {
    speech.textContent = line;
    speech.classList.add('shown');
    await step(sleep(ms));
    speech.classList.remove('shown');
    await step(sleep(450));
  };
  /** Waits for the person's name: typed, or "you choose", or a long quiet. */
  const askName = (): Promise<string> =>
    new Promise((resolve) => {
      const idle = window.setTimeout(() => resolve(pickName()), 30_000);
      const done = (name: string): void => {
        window.clearTimeout(idle);
        resolve(name);
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        done(nameOrPick(input.value));
      });
      q<HTMLButtonElement>('#intro-choose').addEventListener('click', () => done(pickName()));
      input.addEventListener('input', () => window.clearTimeout(idle));
    });

  const flow = async (): Promise<string> => {
    if (mode === 'full') {
      show(skySection);
      // The one line first, on its own; then why we would like the place, and the choice.
      skyActions.hidden = true;
      why.hidden = true;
      await step(sleep(2200));
      why.hidden = false;
      skyActions.hidden = false;
      show(why);
      show(skyActions);
      const choice = new Promise<'match' | 'later'>((resolve) => {
        q('#intro-match').addEventListener('click', () => resolve('match'));
        q('#intro-later').addEventListener('click', () => resolve('later'));
        window.setTimeout(() => resolve('later'), 15_000);
      });
      if ((await step(choice)) === 'match') {
        q<HTMLButtonElement>('#intro-match').disabled = true;
        q<HTMLButtonElement>('#intro-later').disabled = true;
        await step(hooks.matchSky());
      }
      await hide(skySection);
      await step(sleep(300));
      await step(hooks.arrive());
    }
    show(form);
    const name = await step(askName());
    input.blur();
    await hide(form);
    return name;
  };

  const finish = (name: string): string => {
    hooks.release();
    el.classList.add('leaving');
    root.classList.remove('in-intro');
    window.setTimeout(() => el.remove(), 900);
    return name;
  };

  return (async () => {
    try {
      const name = await flow();
      // He says who he is, then what he is for, then walks.
      await say(t('introSayName', { name }), 2200);
      if (mode === 'full') {
        await say(t('introSaySky'), 2800);
        await say(t('introSayLetter'), 2200);
      }
      return finish(name);
    } catch (e) {
      if (e !== ABORT) throw e;
      // Skipped: whatever is typed counts, else one of the four.
      return finish(nameOrPick(input.value));
    }
  })();
}
