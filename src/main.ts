import './style.css';
import { direct } from './core/sceneDirector';
import type { GeoPoint, RenderState, WeatherCondition, WeatherState, WorldState } from './core/types';
import { advance, describeJourney, locate, startJourney } from './core/journey';
import { CONDITIONS, conditionFromCode, demoWeather } from './core/weather';
import { buildWorldState } from './core/world';
import { loadJourney, saveJourney } from './data/journeyStore';
import { DEFAULT_LOCATION, loadLocation, requestLocation, saveLocation } from './data/location';
import { TO_THE_SEA, routeById } from './data/routes';
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
 *   ?km=120            jump the journey to a kilometre mark (not saved)
 *   ?journey=reset     start the journey again from the first place
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

  // The journey: continue the saved one, or set out from the first place.
  const saved = params.get('journey') === 'reset' ? null : loadJourney();
  const route = (saved && routeById(saved.routeId)) || TO_THE_SEA;
  let journey = saved && saved.routeId === route.id ? saved : startJourney(route, Date.now());
  const kmJump = Number(params.get('km'));
  const demoJourney = params.has('km') && Number.isFinite(kmJump);
  if (demoJourney) {
    // A demo peek: walk to that kilometre and rest there for a moment.
    journey = { ...journey, km: Math.max(0, kmJump), restingUntil: null, updatedAt: Date.now() };
  }
  const first = advance(route, journey, Date.now());
  journey = first.state;
  if (!demoJourney) saveJourney(journey);

  const weatherFor = (t: Date): WeatherState | null =>
    forcedWeather ? demoWeather(forcedWeather, t, forcedTweaks) : weather.current(t);

  let world: WorldState;
  let render: RenderState;

  const tick = (): void => {
    const t = now();
    const wall = Date.now();
    const step = advance(route, journey, wall);
    journey = step.state;
    if (step.arrived.length > 0) {
      if (!demoJourney) saveJourney(journey);
      const place = step.arrived[step.arrived.length - 1];
      hud.setNote(place.note ?? `Arrived in ${place.name}.`, 20_000);
    }
    const position = locate(route, journey, wall);
    world = buildWorldState(t, location, weatherFor(t), position);
    render = direct(world);
    renderer.setState(render);
    hud.update(world, render);
    hud.setJourney(describeJourney(position));
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#' + render.sky.top.toString(16).padStart(6, '0'));
  };

  tick();
  // A read-only peek for debugging and screenshots: window.__wanderling.render
  Object.defineProperty(window, '__wanderling', {
    value: { get world() { return world; }, get render() { return render; }, get journey() { return journey; }, renderer },
    configurable: true,
  });
  if (first.arrived.length > 0) {
    // Arrived while the app was closed: say so, once, on opening.
    const place = first.arrived[first.arrived.length - 1];
    hud.setNote(place.note ?? `Arrived in ${place.name}.`, 20_000);
  }
  void weather.refresh(location);

  // The sun barely moves in a few seconds, but the journey engine needs to
  // notice arrivals promptly, and a redraw is cheap. Every 5 s.
  window.setInterval(tick, 5_000);
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
