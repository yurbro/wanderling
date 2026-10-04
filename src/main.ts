import './style.css';
import { direct } from './core/sceneDirector';
import type { GeoPoint, RenderState, WeatherCondition, WeatherState, WorldState } from './core/types';
import { CONDITIONS, conditionFromCode, demoWeather } from './core/weather';
import { buildWorldState } from './core/world';
import { DEFAULT_LOCATION, loadLocation, requestLocation, saveLocation } from './data/location';
import { WeatherService } from './data/weather';
import { SceneRenderer } from './scene/renderer';
import { createHud } from './ui/hud';

/**
 * Query parameters (useful for demos and screenshots):
 *   ?demo=1            show a time scrubber and a weather picker
 *   ?t=18:30           freeze the time of day (today's date, device time zone)
 *   ?lat=..&lon=..     override the location
 *   ?weather=rain      force a weather look (a condition name or a WMO code)
 *   ?temp=-3&wind=30   tweak the forced weather (Celsius, km/h)
 */
async function main(): Promise<void> {
  const root = document.getElementById('app')!;
  const params = new URLSearchParams(window.location.search);

  let location: GeoPoint = loadLocation() ?? DEFAULT_LOCATION;
  const qLat = Number(params.get('lat'));
  const qLon = Number(params.get('lon'));
  if (params.has('lat') && params.has('lon') && Number.isFinite(qLat) && Number.isFinite(qLon)) {
    location = { lat: qLat, lon: qLon, name: params.get('name') ?? 'Somewhere' };
  }

  let minutesOverride: number | null = parseClock(params.get('t'));
  let forcedWeather: WeatherCondition | null = parseWeather(params.get('weather'));
  const forcedTweaks: Partial<WeatherState> = {};
  if (params.has('temp') && Number.isFinite(Number(params.get('temp')))) {
    forcedTweaks.temperature = Number(params.get('temp'));
  }
  if (params.has('wind') && Number.isFinite(Number(params.get('wind')))) {
    forcedTweaks.windSpeed = Number(params.get('wind'));
  }

  const renderer = new SceneRenderer();
  await renderer.init(root);

  const hud = createHud(root, {
    demo: params.get('demo') === '1',
    onLocate: async () => {
      try {
        location = await requestLocation();
        saveLocation(location);
        hud.setNote('');
        hud.hideLocate();
        tick();
        void weather.refresh(location);
      } catch {
        hud.setNote('No location this time. The sky is drawn for London instead.');
      }
    },
    onScrub: (m) => {
      minutesOverride = m;
      tick();
    },
    onWeather: (c) => {
      forcedWeather = c;
      tick();
    },
  });

  if (loadLocation()) hud.hideLocate();

  const now = (): Date => {
    const d = new Date();
    if (minutesOverride !== null) {
      d.setHours(0, 0, 0, 0);
      d.setMinutes(minutesOverride);
    }
    return d;
  };

  // Weather arrives whenever it arrives; the sky is drawn clear until then.
  const weather = new WeatherService(() => tick());

  const weatherFor = (t: Date): WeatherState | null =>
    forcedWeather ? demoWeather(forcedWeather, t, forcedTweaks) : weather.current(t);

  let world: WorldState;
  let render: RenderState;

  const tick = (): void => {
    const t = now();
    world = buildWorldState(t, location, weatherFor(t));
    render = direct(world);
    renderer.setState(render);
    hud.update(world, render);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#' + render.sky.top.toString(16).padStart(6, '0'));
  };

  tick();
  void weather.refresh(location);

  // The sun moves about a quarter of a degree per minute; every 20 s is plenty.
  window.setInterval(tick, 20_000);
  // The weather cache lasts 45 minutes; checking every 5 is cheap and catches it.
  window.setInterval(() => void weather.refresh(location), 5 * 60_000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.pause();
    else {
      renderer.resume();
      tick();
      void weather.refresh(location);
    }
  });
  window.addEventListener('online', () => void weather.refresh(location));
}

function parseClock(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Accepts a condition name ("rain") or a WMO code ("63"). */
function parseWeather(value: string | null): WeatherCondition | null {
  if (!value) return null;
  if ((CONDITIONS as string[]).includes(value)) return value as WeatherCondition;
  const code = Number(value);
  if (Number.isInteger(code)) return conditionFromCode(code, 0.5);
  return null;
}

main().catch((err) => {
  console.error(err);
  const p = document.createElement('p');
  p.style.cssText = 'color:#f4efe4;font-family:serif;padding:24px';
  p.textContent = 'The sky could not be drawn on this device. Please try a newer browser.';
  document.body.appendChild(p);
});
