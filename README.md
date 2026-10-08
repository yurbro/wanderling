# Wanderling

A little wanderer walks the world for you, under the same sky.

Wanderling is a slow companion app. A small traveler keeps walking across real
places while the sky above them (daylight, weather, moon) stays in sync with the
sky above you. No streaks, no tasks, nothing to lose.

**Status:** phase 0 prototype. Right now it draws your sky: the colours follow the
real sun altitude at your location, the moon shows its real phase, the stars come
out when it is dark where you are, and the weather (clouds, rain, snow, fog) follows
the real forecast for your place. A small paper-doll wanderer walks along the path,
opens an umbrella when it rains, carries a lantern after dark and wraps up in a scarf
when it is cold. They set out from your own city (named by a reverse geocode of the
coarse coordinates, or picked by hand) and walk the nearest of seven real routes
(London to the sea, Tokyo to the hot springs, Paris down the Seine, up the Hudson, down
the Pacific coast, the Great Ocean Road, the Jiangnan waters), at a steady 6 km/h
day and night, resting three hours at each place. When a route is done they carry on to
the nearest route not yet walked, on foot, by train or by plane depending on the
distance (seen from a carriage window with the land rushing past, or from a porthole
above a sea of clouds), and once every route is walked they head home and start again. The land
flattens on the plains and at the coast the sea appears, with boats and gulls. Towns have a cottage and a lamp that
light up after dark. Now and then the wanderer stops to look at the sky, or glances at
you. Every place reached sends a postcard, painted with the sky and weather of that
moment, into an album you can open from the main screen, and a footprint map shows the
route on paper with the walked stretch in red and each place lit as it is reached.
It installs as a PWA: once loaded it opens offline, and a small hint explains "Add to
Home Screen" on iOS Safari.

Live preview: https://yurbro.github.io/wanderling/

## How it works

- `src/core/` is pure logic with no browser code. `WorldState` (time, place, sun,
  moon, weather, journey position) goes into `sceneDirector.direct()` and a
  `RenderState` (colours, positions, layer intensities) comes out. `core/weather.ts`
  folds WMO weather codes into a few scene conditions and picks the right hour out of
  a cached forecast. `core/journey.ts` walks a route by the clock: fixed pace, a rest
  at every place, arrivals replayed correctly after any absence. This part has unit
  tests.
- `src/scene/` eases from one `RenderState` to the next over two seconds
  (`core/blend.ts`, colours mixed, intensities slid, names and modes switched at
  once) and draws the result with PixiJS: sky gradient, stars, sun, moon,
  clouds, three layers of hills with fog between them (scrolling at three speeds),
  ground and path with grass and stones sliding past, the wanderer, rain or snow.
- `src/data/` talks to the outside world: browser location, the free
  [Open-Meteo](https://open-meteo.com/) forecast (cached in `localStorage` for 45
  minutes and reused as an hourly forecast when the network is gone), two keyless
  geocoders (BigDataCloud for coordinates to a city name, Open-Meteo for a typed city
  name to coordinates; only two-decimal coordinates are ever sent), the route data
  and the saved journey.
- `src/ui/` is a thin DOM overlay for the clock, place name and buttons, plus the
  postcard album (`ui/album.ts`) and the footprint map (`ui/map.ts`, plain SVG laid
  out by `core/map.ts`).

Useful URL parameters for demos and screenshots:

| Parameter | Effect |
| --- | --- |
| `?demo=1` | shows a time-of-day scrubber and a weather picker |
| `?t=18:30` | freezes the time of day |
| `?lat=35.68&lon=139.69&name=Tokyo` | draws the sky for another place |
| `?weather=rain` | forces a weather look: `clear`, `partly-cloudy`, `overcast`, `fog`, `drizzle`, `rain`, `heavy-rain`, `thunderstorm`, `snow`, `heavy-snow`, or a WMO code such as `63` |
| `?temp=-3&wind=30` | tweaks the forced weather (Celsius, km/h) |
| `?km=120` | peeks at the journey at a kilometre mark (not saved) |
| `?journey=reset` | starts the journey again from the first place (and empties the album) |
| `?journey=next` | jumps to the next segment of the chain (not saved) |
| `?lang=zh` | Chinese interface for this visit (the bottom button switches and remembers) |
| `?postcards=demo` | adds three sample postcards to the album (not saved) |
| `?day=3` | the first week as a new traveller on day 3 (0 to 7), earlier days replayed (not saved) |
| `?day=3&hour=21` | the same, at 21:00 that day |
| `?day=reset` | forgets the answers tapped in `?day=` runs |
| `?surprise=cat` | the day-2 cat now (also `rainbow`, `fullMoon`, `snowGlobe`, `wave`, `missed`) |

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run build      # type-check and production build into dist/
```

Every push to `main` runs the tests, builds the site and deploys it to GitHub Pages
(see `.github/workflows/deploy.yml`). The Pages source must be set to "GitHub Actions"
once, in the repository settings.

Offline support comes from `public/sw.js`, a small hand-written service worker: the
page is fetched network-first (so a new deploy shows up) and served from cache when
offline, hashed assets are cached for good, weather requests are never cached. The
build stamps a version into `dist/sw.js` (`tools/stamp-sw.cjs`) so each deploy gets a
fresh cache. The worker is not registered on the dev server.

Icons are generated by `tools/make-icons.cjs` (needs `sharp`, not a project dependency).
Screenshots for visual checks come from `tools/screenshot.cjs` (needs `playwright`, also
not a project dependency; see the comment at the top of the file for its knobs).

## Stack decisions

TypeScript + Vite + PixiJS, shipped as a PWA first, wrapped with Capacitor for the
App Store later. Design notes and the product plan live in the Claude project that
drives development.
