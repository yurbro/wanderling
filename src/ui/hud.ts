import type { RenderState, WorldState } from '../core/types';

export interface HudOptions {
  demo: boolean;
  onLocate: () => Promise<void>;
  onScrub?: (minutesOfDay: number) => void;
}

export interface Hud {
  update(ws: WorldState, rs: RenderState): void;
  setLocating(flag: boolean): void;
  setNote(text: string): void;
  hideLocate(): void;
}

/** Thin DOM overlay: wordmark, clock, place, and a single soft button. */
export function createHud(root: HTMLElement, opts: HudOptions): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-top">
      <div class="wordmark">Wanderling</div>
      <div class="clock" id="hud-clock">--:--</div>
      <div class="place" id="hud-place"></div>
    </div>
    <div class="hud-bottom">
      <div class="note" id="hud-note"></div>
      <button class="pill" id="hud-locate" type="button">Use my location</button>
      ${
        opts.demo
          ? `<label class="demo">
               <input id="hud-scrub" type="range" min="0" max="1439" step="5" value="720" />
               <span id="hud-scrub-label">12:00</span>
             </label>`
          : ''
      }
    </div>
  `;
  root.appendChild(el);

  const clock = el.querySelector<HTMLDivElement>('#hud-clock')!;
  const place = el.querySelector<HTMLDivElement>('#hud-place')!;
  const note = el.querySelector<HTMLDivElement>('#hud-note')!;
  const locate = el.querySelector<HTMLButtonElement>('#hud-locate')!;
  const scrub = el.querySelector<HTMLInputElement>('#hud-scrub');
  const scrubLabel = el.querySelector<HTMLSpanElement>('#hud-scrub-label');

  locate.addEventListener('click', async () => {
    locate.disabled = true;
    locate.textContent = 'Finding your sky…';
    try {
      await opts.onLocate();
    } finally {
      locate.disabled = false;
      locate.textContent = 'Use my location';
    }
  });

  if (scrub && scrubLabel && opts.onScrub) {
    scrub.addEventListener('input', () => {
      const m = Number(scrub.value);
      scrubLabel.textContent = fmtMinutes(m);
      opts.onScrub!(m);
    });
  }

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

  return {
    update(ws, rs) {
      clock.textContent = timeFmt.format(ws.now);
      place.textContent = ws.location.name ?? 'Your sky';
      el.classList.toggle('dark-ink', rs.darkInk);
      if (scrub && scrubLabel) {
        const m = ws.now.getHours() * 60 + ws.now.getMinutes();
        scrub.value = String(m);
        scrubLabel.textContent = fmtMinutes(m);
      }
    },
    setLocating(flag) {
      locate.disabled = flag;
    },
    setNote(text) {
      note.textContent = text;
    },
    hideLocate() {
      locate.hidden = true;
    },
  };
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
