import type { RenderState, WeatherCondition, WeatherState, WorldState } from '../core/types';
import { getLang, t } from '../core/i18n';
import { CONDITIONS, describeWeather, formatTemperature } from '../core/weather';

export interface HudOptions {
  demo: boolean;
  onScrub?: (minutesOfDay: number) => void;
  /** Demo only: null means "back to the real weather". */
  onWeather?: (condition: WeatherCondition | null) => void;
  onAlbum?: () => void;
  onMail?: () => void;
  onMap?: () => void;
  /** Tapping the place name: choose a city by hand. */
  onPlace?: () => void;
  /** The gear button at the foot: name, place, language and motion live there. */
  onSettings?: () => void;
}

export interface Hud {
  update(ws: WorldState, rs: RenderState): void;
  /** A short message near the bottom; it fades out after a while. */
  setNote(text: string, lingerMs?: number): void;
  setJourney(text: string): void;
  /** Postcard count on the album button; `fresh` pulses it until opened. */
  setPostcards(count: number, fresh: boolean): void;
  /** Unread letters on the letters button; it pulses while there are any. */
  setMail(unread: number): void;
  /** The temperature unit the HUD picked from the browser language. */
  readonly unit: 'C' | 'F';
}

const PRETTY: Record<WeatherCondition, { en: string; zh: string }> = {
  clear: { en: 'Clear', zh: '晴' },
  'partly-cloudy': { en: 'Partly cloudy', zh: '多云' },
  overcast: { en: 'Overcast', zh: '阴' },
  fog: { en: 'Fog', zh: '雾' },
  drizzle: { en: 'Drizzle', zh: '毛毛雨' },
  rain: { en: 'Rain', zh: '雨' },
  'heavy-rain': { en: 'Heavy rain', zh: '大雨' },
  thunderstorm: { en: 'Thunderstorm', zh: '雷雨' },
  snow: { en: 'Snow', zh: '雪' },
  'heavy-snow': { en: 'Heavy snow', zh: '大雪' },
};

/** Thin DOM overlay: wordmark, clock, place, weather line, and a single soft button. */
export function createHud(root: HTMLElement, opts: HudOptions): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-top">
      <div class="wordmark">Wanderling</div>
      <div class="clock" id="hud-clock">--:--</div>
      <div class="place" id="hud-place"></div>
      <div class="weather" id="hud-weather" hidden></div>
      <div class="journey" id="hud-journey"></div>
    </div>
    <div class="hud-bottom">
      <div class="note" id="hud-note"></div>
      <div class="hud-buttons">
        <button class="pill" id="hud-mail" type="button">${t('mail')}</button>
        <button class="pill" id="hud-album" type="button">${t('postcards')}</button>
        <button class="pill" id="hud-map" type="button">${t('map')}</button>
        <button class="pill" id="hud-settings" type="button">${t('settings')}</button>
      </div>
      ${
        opts.demo
          ? `<label class="demo">
               <input id="hud-scrub" type="range" min="0" max="1439" step="5" value="720" />
               <span id="hud-scrub-label">12:00</span>
             </label>
             <label class="demo demo-weather">
               <span>${t('weather')}</span>
               <select id="hud-weather-select">
                 <option value="">${t('real')}</option>
                 ${CONDITIONS.map((c) => `<option value="${c}">${PRETTY[c][getLang()]}</option>`).join('')}
               </select>
             </label>`
          : ''
      }
    </div>
  `;
  root.appendChild(el);

  const clock = el.querySelector<HTMLDivElement>('#hud-clock')!;
  const place = el.querySelector<HTMLDivElement>('#hud-place')!;
  const weather = el.querySelector<HTMLDivElement>('#hud-weather')!;
  const note = el.querySelector<HTMLDivElement>('#hud-note')!;
  const journey = el.querySelector<HTMLDivElement>('#hud-journey')!;
  let noteTimer: number | null = null;
  const album = el.querySelector<HTMLButtonElement>('#hud-album')!;
  const mail = el.querySelector<HTMLButtonElement>('#hud-mail')!;
  const map = el.querySelector<HTMLButtonElement>('#hud-map')!;
  el.querySelector<HTMLButtonElement>('#hud-settings')!.addEventListener('click', () => opts.onSettings?.());
  const scrub = el.querySelector<HTMLInputElement>('#hud-scrub');
  const scrubLabel = el.querySelector<HTMLSpanElement>('#hud-scrub-label');
  const weatherSelect = el.querySelector<HTMLSelectElement>('#hud-weather-select');

  if (scrub && scrubLabel && opts.onScrub) {
    scrub.addEventListener('input', () => {
      const m = Number(scrub.value);
      scrubLabel.textContent = fmtMinutes(m);
      opts.onScrub!(m);
    });
  }

  mail.addEventListener('click', () => {
    mail.classList.remove('has-new');
    opts.onMail?.();
  });
  album.addEventListener('click', () => {
    album.classList.remove('has-new');
    opts.onAlbum?.();
  });
  map.addEventListener('click', () => opts.onMap?.());
  place.addEventListener('click', () => opts.onPlace?.());

  if (weatherSelect && opts.onWeather) {
    weatherSelect.addEventListener('change', () => {
      const v = weatherSelect.value as WeatherCondition | '';
      opts.onWeather!(v === '' ? null : v);
    });
  }

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  // Americans read Fahrenheit; everyone else we serve reads Celsius.
  const unit: 'C' | 'F' = /^en-US\b/i.test(navigator.language ?? '') ? 'F' : 'C';

  return {
    update(ws, rs) {
      clock.textContent = timeFmt.format(ws.now);
      place.textContent = !ws.location.name || ws.location.name === 'Your sky' ? t('yourSky') : ws.location.name;
      weather.hidden = !ws.weather;
      if (ws.weather) weather.textContent = weatherLine(ws.weather, unit);
      el.classList.toggle('dark-ink', rs.darkInk);
      if (scrub && scrubLabel) {
        const m = ws.now.getHours() * 60 + ws.now.getMinutes();
        scrub.value = String(m);
        scrubLabel.textContent = fmtMinutes(m);
      }
      if (weatherSelect && ws.weather?.source === 'demo') {
        weatherSelect.value = ws.weather.condition;
      }
    },
    setNote(text, lingerMs) {
      note.textContent = text;
      note.classList.toggle('visible', text !== '');
      if (noteTimer !== null) window.clearTimeout(noteTimer);
      noteTimer = null;
      if (text && lingerMs) {
        noteTimer = window.setTimeout(() => {
          note.classList.remove('visible');
          noteTimer = null;
        }, lingerMs);
      }
    },
    setJourney(text) {
      journey.textContent = text;
    },
    setMail(unread) {
      mail.textContent = unread > 0 ? `${t('mail')} · ${unread}` : t('mail');
      mail.classList.toggle('has-new', unread > 0);
    },
    setPostcards(count, fresh) {
      album.textContent = count > 0 ? `${t('postcards')} · ${count}` : t('postcards');
      album.classList.toggle('has-new', fresh);
    },
    unit,
  };
}

function weatherLine(w: WeatherState, unit: 'C' | 'F'): string {
  const parts = [formatTemperature(w.temperature, unit), describeWeather(w)];
  if (w.source === 'forecast') parts.push(t('forecast'));
  return parts.join(' · ');
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
