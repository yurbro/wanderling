import './style.css';
import { direct } from './core/sceneDirector';
import type { GeoPoint, JourneyState, RenderState, Route, WeatherCondition, WeatherState, WorldState } from './core/types';
import { buildSegmentRoute, departureNote, nextSegment } from './core/chain';
import { homeFrom, nearestRoute, routeFromHome } from './core/geo';
import { REST_MS, advance, describeJourney, lastArrival, locate, startJourney } from './core/journey';
import { demoPostcards, makePostcard, missingArrivals } from './core/postcards';
import { CONDITIONS, conditionFromCode, demoWeather } from './core/weather';
import { buildWorldState } from './core/world';
import { reverseGeocode, searchCity } from './data/geocode';
import { loadJourney, saveJourney } from './data/journeyStore';
import { clearPostcards, loadPostcards, savePostcards } from './data/postcardStore';
import { DEFAULT_LOCATION, isDefaultLocation, loadLocation, requestLocation, saveLocation } from './data/location';
import { ROUTES, TO_THE_SEA } from './data/routes';
import { WeatherService } from './data/weather';
import { SceneRenderer } from './scene/renderer';
import { createAlbum } from './ui/album';
import { createCityChooser } from './ui/city';
import { createHud } from './ui/hud';
import { setupInstallHint } from './ui/install';
import { createMap } from './ui/map';

/**
 * Query parameters (useful for demos and screenshots):
 *   ?demo=1            show a time scrubber and a weather picker
 *   ?t=18:30           freeze the time of day (today's date, device time zone)
 *   ?lat=..&lon=..     override the location
 *   ?weather=rain      force a weather look (a condition name or a WMO code)
 *   ?temp=-3&wind=30   tweak the forced weather (Celsius, km/h)
 *   ?km=120            jump the journey to a kilometre mark (not saved)
 *   ?journey=reset     start the journey again from the first place
 *   ?journey=next      jump to the next segment of the chain right away (not saved)
 *   ?postcards=demo    add three sample postcards to the album (not saved)
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
        const found = await requestLocation();
        hud.setNote('');
        hud.hideLocate();
        await moveTo(found);
      } catch {
        hud.setNote('No location this time. Tap the place name to pick a city instead.', 8000);
      }
    },
    onPlace: () => city.open(),
    onScrub: (m) => {
      minutesOverride = m;
      tick();
    },
    onWeather: (c) => {
      forcedWeather = c;
      tick();
    },
    onAlbum: () => {
      album.setCards(allCards());
      album.open();
    },
    onMap: () => {
      map.update(route, locate(route, journey, Date.now()), allCards());
      map.open();
    },
  });
  const album = createAlbum(root, hud.unit);
  const map = createMap(root);
  const city = createCityChooser(root, searchCity, (picked) => {
    hud.hideLocate();
    void moveTo({ lat: picked.lat, lon: picked.lon, name: picked.name, region: picked.region });
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

  // The journey: continue the saved one, or set out from home (the person's
  // own city when known, else the first place of the nearest route).
  const resetJourney = params.get('journey') === 'reset';
  if (resetJourney) clearPostcards();
  const saved = resetJourney ? null : loadJourney();
  const freshJourney = (from: GeoPoint): { route: Route; journey: JourneyState } => {
    const home = homeFrom(from, isDefaultLocation(from));
    const base = home ? nearestRoute(ROUTES, home).route : TO_THE_SEA;
    const route = routeFromHome(base, home);
    return { route, journey: { ...startJourney(route, Date.now()), home, from: null, walked: [] } };
  };
  let route: Route;
  let journey: JourneyState;
  const savedRoute = saved ? buildSegmentRoute(saved, ROUTES) : null;
  if (saved && savedRoute) {
    route = savedRoute;
    journey = saved;
  } else {
    ({ route, journey } = freshJourney(location));
  }
  const kmJump = Number(params.get('km'));
  const jumpNext = params.get('journey') === 'next';
  const demoJourney = (params.has('km') && Number.isFinite(kmJump)) || jumpNext;
  let departure: string | null = null;
  if (jumpNext) {
    // A demo peek at the chain: finish this segment and set off on the next.
    const done = advance(route, { ...journey, km: 1e9, restingUntil: null, updatedAt: Date.now() - 1 }, Date.now());
    ({ route, journey } = nextSegment(done.state, route, ROUTES, Date.now()));
    departure = departureNote(route.legs[0]?.mode ?? 'walk', route.places[1]?.name ?? route.name);
  }
  if (demoJourney) {
    // A demo peek: walk to that kilometre and rest there for a moment.
    journey = { ...journey, km: Math.max(0, kmJump), restingUntil: null, updatedAt: Date.now() };
  }
  const first = advance(route, journey, Date.now());
  journey = first.state;
  if (!demoJourney) saveJourney(journey);

  // Postcards: one per arrival. Any arrival without a card gets one on the
  // next tick, so a week away still fills the album, in order.
  let postcards = loadPostcards();
  const sampleCards = params.get('postcards') === 'demo' ? demoPostcards(route, location, Date.now()) : [];
  const allCards = () => [...sampleCards, ...postcards];
  let freshCards = false;
  const syncPostcards = (): void => {
    const missing = missingArrivals(route, journey, postcards);
    if (missing.length === 0) return;
    for (const arrival of missing) {
      const card = makePostcard(route, arrival, location, forcedWeather ? null : weather.current(new Date(arrival.at)));
      if (card) postcards = [...postcards, card];
    }
    if (!demoJourney) savePostcards(postcards);
    freshCards = true;
    hud.setPostcards(allCards().length, true);
    if (album.isOpen) album.setCards(allCards());
  };

  const weatherFor = (t: Date): WeatherState | null =>
    forcedWeather ? demoWeather(forcedWeather, t, forcedTweaks) : weather.current(t);

  let world: WorldState;
  let render: RenderState;

  /** A journey that has barely begun restarts from the new home; an old one carries on. */
  const barelyStarted = (): boolean => journey.km < 2 && journey.arrivals.length <= 1 && !demoJourney;

  const moveTo = async (p: GeoPoint): Promise<void> => {
    location = p;
    saveLocation(location);
    tick();
    void weather.refresh(location);
    if (!p.name || p.name === 'Your sky') {
      const named = await reverseGeocode(p);
      if (named) {
        location = { ...location, name: named.name, region: named.region };
        saveLocation(location);
      }
    }
    if (barelyStarted()) {
      ({ route, journey } = freshJourney(location));
      postcards = [];
      clearPostcards();
      saveJourney(journey);
      hud.setPostcards(0, false);
    }
    tick();
  };

  // A location saved before names existed gets its city name now.
  if (!isDefaultLocation(location) && (!location.name || location.name === 'Your sky')) {
    void reverseGeocode(location).then((named) => {
      if (!named) return;
      location = { ...location, name: named.name, region: named.region };
      saveLocation(location);
      if (journey.home && journey.home.name === 'Home' && barelyStarted()) {
        ({ route, journey } = freshJourney(location));
        postcards = [];
        clearPostcards();
        saveJourney(journey);
      }
      tick();
    });
  }

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
    // A finished route, rest over: set off on the next segment of the chain.
    const posNow = locate(route, journey, wall);
    const rested = lastArrival(journey);
    if (posNow.finished && rested && wall >= rested.at + REST_MS) {
      const seg = nextSegment(journey, route, ROUTES, wall);
      route = seg.route;
      journey = seg.journey;
      if (!demoJourney) saveJourney(journey);
      const firstLeg = route.legs[0];
      hud.setNote(departureNote(firstLeg?.mode ?? 'walk', route.places[1]?.name ?? route.name), 15_000);
    }
    syncPostcards();
    const position = locate(route, journey, wall);
    world = buildWorldState(t, location, weatherFor(t), position);
    render = direct(world);
    renderer.setState(render);
    hud.update(world, render);
    hud.setJourney(describeJourney(position));
    if (map.isOpen) map.update(route, position, allCards());
    const skyCss = '#' + render.sky.top.toString(16).padStart(6, '0');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skyCss);
    rememberSky(skyCss);
  };

  hud.setPostcards(allCards().length, false);
  freshCards = false;
  tick();
  if (postcards.length > 1 || sampleCards.length > 0) hud.setPostcards(allCards().length, freshCards);
  // A read-only peek for debugging and screenshots: window.__wanderling.render
  Object.defineProperty(window, '__wanderling', {
    value: { get world() { return world; }, get render() { return render; }, get journey() { return journey; }, get postcards() { return allCards(); }, renderer, album, map },
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

  // The canvas fades in once the first frame is drawn.
  requestAnimationFrame(() => root.classList.add('ready'));

  setupInstallHint(root);
  registerServiceWorker();
}

/** Keeps the last sky colour so the next launch paints it before anything loads. */
let lastRemembered = '';
function rememberSky(css: string): void {
  if (css === lastRemembered) return;
  lastRemembered = css;
  try {
    localStorage.setItem('wanderling.lastSky', css);
  } catch {
    // Not important.
  }
}

/** Offline support: see public/sw.js. Skipped on dev servers and old browsers. */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const register = (): void => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('[wanderling] service worker not registered', err);
    });
  };
  // main() is async, so the page may well have finished loading already.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
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
