import { describe, expect, it } from 'vitest';
import { KM_PER_HOUR, advance, locate, startJourney } from '../src/core/journey';
import { routeFromHome } from '../src/core/geo';
import { describeProgress, labelBox, layoutRoute, mapProgress, wobble } from '../src/core/map';
import { ROUTES, TO_THE_SEA } from '../src/data/routes';
import type { Route } from '../src/core/types';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 4, 8, 0, 0);

describe('layoutRoute', () => {
  it('keeps every place inside the margins, north up', () => {
    const layout = layoutRoute(TO_THE_SEA, 320, 440, 48);
    expect(layout.points).toHaveLength(TO_THE_SEA.places.length);
    for (const p of layout.points) {
      expect(p.x).toBeGreaterThanOrEqual(48 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(320 - 48 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(48 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(440 - 48 + 1e-6);
    }
    // London is the northernmost place, so it sits highest on the page.
    const london = layout.points.find((p) => p.id === 'london')!;
    const sisters = layout.points.find((p) => p.id === 'seven-sisters')!;
    expect(london.y).toBeLessThan(sisters.y);
    // Seven Sisters is east of London, so further right.
    expect(sisters.x).toBeGreaterThan(london.x);
  });

  it('uses one scale for both axes and fills the longer one', () => {
    const layout = layoutRoute(TO_THE_SEA, 320, 440, 48);
    const ys = layout.points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(440 - 96, 6);
    const xs = layout.points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(320 - 96);
  });

  it('keeps names off each other and off other dots on every bundled route', () => {
    for (const route of ROUTES) {
      const layout = layoutRoute(route, 320, 440, 48);
      const boxes = layout.points.map((p) => labelBox(p, p.labelSide));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          // A sliver of a few square pixels is invisible; a real overlap is not.
          const area = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
          expect(area, `${route.id}: ${layout.points[i].name} vs ${layout.points[j].name}`).toBeLessThan(20);
        }
        for (let j = 0; j < layout.points.length; j++) {
          if (j === i) continue;
          const q = layout.points[j];
          const hits = boxes[i].x1 < q.x + 6 && q.x - 6 < boxes[i].x2 && boxes[i].y1 < q.y + 6 && q.y - 6 < boxes[i].y2;
          expect(hits, `${route.id}: ${layout.points[i].name} label over ${q.name}`).toBe(false);
        }
      }
    }
  });

  it('prefers the side away from the nearer edge when there is room', () => {
    const layout = layoutRoute(TO_THE_SEA, 320, 440, 48);
    const london = layout.points.find((p) => p.id === 'london')!;
    expect(london.labelSide).toBe(london.x < 160 ? 'right' : 'left');
  });

  it('spaces places without coordinates evenly', () => {
    const bare: Route = {
      id: 'b',
      name: 'b',
      places: [
        { id: 'a', name: 'A', terrain: 'plain' },
        { id: 'b', name: 'B', terrain: 'plain' },
        { id: 'c', name: 'C', terrain: 'plain' },
      ],
      legs: [
        { km: 1, terrain: 'plain' },
        { km: 1, terrain: 'plain' },
      ],
    };
    const layout = layoutRoute(bare, 200, 300, 20);
    expect(layout.points.map((p) => p.y)).toEqual([20, 150, 280]);
    expect(new Set(layout.points.map((p) => p.x)).size).toBe(1);
  });
});

describe('mapProgress', () => {
  const layout = layoutRoute(TO_THE_SEA);

  it('starts at the first place with everything ahead', () => {
    const pos = locate(TO_THE_SEA, startJourney(TO_THE_SEA, T0), T0);
    const p = mapProgress(layout, pos);
    expect(p.reached).toEqual(['london']);
    expect(p.current).toEqual({ x: layout.points[0].x, y: layout.points[0].y });
    expect(p.walked).toHaveLength(2);
    expect(p.ahead).toHaveLength(layout.points.length);
    expect(describeProgress(p)).toBe('1 of 8 places · 0 km of 144');
  });

  it('puts the wanderer part way along the current leg', () => {
    // Half of the first leg (13 km) walked.
    const t = T0 + (6.5 / KM_PER_HOUR) * H;
    const pos = locate(TO_THE_SEA, advance(TO_THE_SEA, startJourney(TO_THE_SEA, T0), t).state, t);
    const p = mapProgress(layout, pos);
    const a = layout.points[0];
    const b = layout.points[1];
    expect(p.current.x).toBeCloseTo((a.x + b.x) / 2, 6);
    expect(p.current.y).toBeCloseTo((a.y + b.y) / 2, 6);
    expect(p.reached).toEqual(['london']);
  });

  it('lights every place and ends at the last one when finished', () => {
    const t = T0 + 365 * 24 * H;
    const pos = locate(TO_THE_SEA, advance(TO_THE_SEA, startJourney(TO_THE_SEA, T0), t).state, t);
    const p = mapProgress(layout, pos);
    expect(p.reached).toHaveLength(8);
    const last = layout.points[7];
    expect(p.current).toEqual({ x: last.x, y: last.y });
    expect(p.ahead).toHaveLength(1);
    expect(describeProgress(p)).toBe('8 of 8 places · 144 km of 144');
  });

  it('copes with no journey at all', () => {
    const p = mapProgress(layout, null);
    expect(p.reached).toEqual(['london']);
    expect(describeProgress(p)).toBe('1 of 8 places');
  });
});

describe('wobble', () => {
  it('keeps the end points and passes through every corner', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    const w = wobble(path, 2, 10);
    expect(w[0]).toEqual({ x: 0, y: 0 });
    expect(w[w.length - 1].x).toBeCloseTo(100, 6);
    expect(w[w.length - 1].y).toBeCloseTo(50, 6);
    expect(w.some((p) => Math.abs(p.x - 100) < 1e-6 && Math.abs(p.y) < 1e-6)).toBe(true);
    expect(w.length).toBeGreaterThan(path.length);
    // Never strays more than the amplitude from the straight line.
    for (const p of w.slice(1, 11)) expect(Math.abs(p.y)).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe('a segment reached by plane', () => {
  const flown = routeFromHome(TO_THE_SEA, { name: 'Tokyo', lat: 35.68, lon: 139.69 });

  it('leaves the far-away start off the sheet', () => {
    const layout = layoutRoute(flown);
    expect(layout.skip).toBe(1);
    expect(layout.points[0].id).toBe('london');
    expect(layout.points).toHaveLength(TO_THE_SEA.places.length);
  });

  it('shows the wanderer at the first place while still in the air, then on the route', () => {
    const layout = layoutRoute(flown);
    const s = startJourney(flown, T0);
    const inAir = locate(flown, advance(flown, s, T0 + 1 * H).state, T0 + 1 * H);
    expect(inAir.mode).toBe('fly');
    const p = mapProgress(layout, inAir);
    expect(p.reached).toEqual([]);
    expect(p.current).toEqual({ x: layout.points[0].x, y: layout.points[0].y });
    expect(p.walked).toHaveLength(1);
    const landedAt = T0 + (flown.legs[0].km / 700 + 4) * H;
    const onRoute = locate(flown, advance(flown, s, landedAt).state, landedAt);
    const q = mapProgress(layout, onRoute);
    expect(q.reached).toEqual(['london']);
    expect(q.walked.length).toBeGreaterThanOrEqual(2);
  });
});
