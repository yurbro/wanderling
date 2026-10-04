import type { Position, Route, Terrain } from './types';

/**
 * The footprint map, pure part: project the route's places onto a sheet of
 * paper and work out which stretch has been walked. The UI only draws.
 */

export interface MapPoint {
  id: string;
  name: string;
  terrain: Terrain;
  x: number;
  y: number;
  /** Which side of the dot the name goes, to keep labels on the page. */
  labelSide: 'left' | 'right';
}

export interface MapLayout {
  width: number;
  height: number;
  points: MapPoint[];
}

export interface XY {
  x: number;
  y: number;
}

/**
 * Equirectangular projection, north up, scaled uniformly to fit the sheet
 * with a margin. Places without coordinates fall back to an even spacing
 * down the page so a route never fails to draw.
 */
export function layoutRoute(route: Route, width = 320, height = 440, padding = 48): MapLayout {
  const places = route.places;
  const hasCoords = places.every((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
  let raw: XY[];
  if (hasCoords && places.length > 0) {
    const latMean = places.reduce((s, p) => s + p.lat!, 0) / places.length;
    const k = Math.cos((latMean * Math.PI) / 180);
    raw = places.map((p) => ({ x: p.lon! * k, y: -p.lat! }));
  } else {
    raw = places.map((_, i) => ({ x: 0, y: i }));
  }
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = padding + (innerW - spanX * scale) / 2;
  const offY = padding + (innerH - spanY * scale) / 2;
  const points: MapPoint[] = places.map((p, i) => {
    const x = offX + (raw[i].x - minX) * scale;
    const y = offY + (raw[i].y - minY) * scale;
    return { id: p.id, name: p.name, terrain: p.terrain, x, y, labelSide: x < width / 2 ? 'right' : 'left' };
  });
  return { width, height, points };
}

export interface MapProgress {
  /** Ids of the places reached so far, in route order. */
  reached: string[];
  /** Where the wanderer is on the sheet. */
  current: XY;
  /** The stretch walked: start to the current point. */
  walked: XY[];
  /** The stretch ahead: current point to the end. */
  ahead: XY[];
  walkedKm: number;
  totalKm: number;
  placeCount: number;
}

export function mapProgress(layout: MapLayout, pos: Position | null): MapProgress {
  const pts = layout.points;
  if (pts.length === 0) {
    return { reached: [], current: { x: 0, y: 0 }, walked: [], ahead: [], walkedKm: 0, totalKm: 0, placeCount: 0 };
  }
  if (!pos) {
    return {
      reached: [pts[0].id],
      current: { x: pts[0].x, y: pts[0].y },
      walked: [{ x: pts[0].x, y: pts[0].y }],
      ahead: pts.map(({ x, y }) => ({ x, y })),
      walkedKm: 0,
      totalKm: 0,
      placeCount: pts.length,
    };
  }
  const lastReached = pos.finished ? pts.length - 1 : Math.min(pos.legIndex, pts.length - 1);
  const reached = pts.slice(0, lastReached + 1).map((p) => p.id);
  let current: XY;
  if (pos.finished || lastReached >= pts.length - 1) {
    current = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  } else {
    const a = pts[lastReached];
    const b = pts[lastReached + 1];
    const f = Math.max(0, Math.min(1, pos.fraction));
    current = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  const walked = [...pts.slice(0, lastReached + 1).map(({ x, y }) => ({ x, y })), current];
  const ahead = [current, ...pts.slice(lastReached + 1).map(({ x, y }) => ({ x, y }))];
  return {
    reached,
    current,
    walked,
    ahead,
    walkedKm: pos.km,
    totalKm: pos.totalKm,
    placeCount: pts.length,
  };
}

/**
 * Subdivide a polyline and nudge the middle points sideways a little, so a
 * ruler-straight route looks drawn by hand. Deterministic for a given path.
 */
export function wobble(path: XY[], amplitude = 1.6, step = 14): XY[] {
  if (path.length < 2) return path.map((p) => ({ ...p }));
  const out: XY[] = [{ ...path[0] }];
  let seed = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(len / step));
    const nx = -dy / (len || 1);
    const ny = dx / (len || 1);
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      seed += 1;
      // Zero at both ends of every segment so the line still passes through the dots.
      const s = Math.sin(t * Math.PI) * Math.sin(seed * 1.7 + t * 6.1) * amplitude;
      out.push({ x: a.x + dx * t + nx * s, y: a.y + dy * t + ny * s });
    }
  }
  return out;
}

/** "3 of 8 places · 58 km of 144" */
export function describeProgress(p: MapProgress): string {
  const places = `${p.reached.length} of ${p.placeCount} places`;
  if (p.totalKm <= 0) return places;
  return `${places} · ${Math.round(p.walkedKm)} km of ${Math.round(p.totalKm)}`;
}
