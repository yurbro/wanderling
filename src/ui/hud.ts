import type { RenderState, WeatherCondition, WeatherState, WorldState } from '../core/types';
import { CONDITIONS, describeWeather, formatTemperature } from '../core/weather';

export interface HudOptions {
  demo: boolean;
  onLocate: () => Promise<void>;
  onScrub?: (minutesOfDay: number) => void;
  /** Demo only: null means "back to the real weather". */
  onWeather?: (condition: WeatherCondition | null) => void;
}

export interface Hud {
  update(ws: WorldState, rs: RenderState): void;
  setLocating(flag: boolean): void;
  setNote(text: string): void;
  hideLocate(): void;
}

const PRETTY: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  overcast: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  'heavy-rain': 'Heavy rain',
  thunderstorm: 'Thunderstorm',
  snow: 'Snow',
  'heavy-snow': 'Heavy snow',
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
    </div>
    <div class="hud-bottom">
      <div class="note" id="hud-note"></div>
      <button class="pill" id="hud-locate" type="button">Use my location</button>
      ${
        opts.demo
          ? `<label class="demo">
               <input id="hud-scrub" type="range" min="0" max="1439" step="5" value="720" />
               <span id="hud-scrub-label">12:00</span>
             </label>
             <label class="demo demo-weather">
               <span>Weather</span>
               <select id="hud-weather-select">
                 <option value="">real</option>
                 ${CONDITIONS.map((c) => `<option value="${c}">${PRETTY[c]}</option>`).join('')}
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
  const locate = el.querySelector<HTMLButtonElement>('#hud-locate')!;
  const scrub = el.querySelector<HTMLInputElement>('#hud-scrub');
  const scrubLabel = el.querySelector<HTMLSpanElement>('#hud-scrub-label');
  const weatherSelect = el.querySelector<HTMLSelectElement>('#hud-weather-select');

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
      place.textContent = ws.location.name ?? 'Your sky';
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

function weatherLine(w: WeatherState, unit: 'C' | 'F'): string {
  const parts = [formatTemperature(w.temperature, unit), describeWeather(w)];
  if (w.source === 'forecast') parts.push('(forecast)');
  return parts.join(' · ');
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
