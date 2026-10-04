import type { Position, Route, Terrain } from './types';

/**
 * The footprint map, pure part: project the route's places onto a sheet of
 * paper and work out which stretch has been walked. The UI only draws.
 */

export type LabelSide = 'right' | 'left' | 'above' | 'below';

export interface MapPoint {
  id: string;
  name: string;
  terrain: Terrain;
  x: number;
  y: number;
  /** Where the name goes relative to the dot, chosen so names do not collide. */
  labelSide: LabelSide;
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
  placeLabels(points, width, height);
  return { width, height, points };
}

/* ---------------------------------------------------------------- labels */

export const LABEL_FONT = 12.5;
const CHAR_W = 0.54 * LABEL_FONT;
/** Glyphs with ascenders and descenders span about the font size. */
const LABEL_H = LABEL_FONT;
const DOT_R = 6;

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The rectangle a name occupies for a given side of its dot. */
export function labelBox(p: { x: number; y: number; name: string }, side: LabelSide): Box {
  const w = p.name.length * CHAR_W;
  switch (side) {
    case 'right':
      return { x1: p.x + 9, y1: p.y - LABEL_H / 2, x2: p.x + 9 + w, y2: p.y + LABEL_H / 2 };
    case 'left':
      return { x1: p.x - 9 - w, y1: p.y - LABEL_H / 2, x2: p.x - 9, y2: p.y + LABEL_H / 2 };
    case 'above':
      return { x1: p.x - w / 2, y1: p.y - 9 - LABEL_H, x2: p.x + w / 2, y2: p.y - 9 };
    default:
      return { x1: p.x - w / 2, y1: p.y + 9, x2: p.x + w / 2, y2: p.y + 9 + LABEL_H };
  }
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
}

function outsideArea(box: Box, sheet: Box): number {
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  const dx = Math.max(0, sheet.x1 - box.x1) + Math.max(0, box.x2 - sheet.x2);
  const dy = Math.max(0, sheet.y1 - box.y1) + Math.max(0, box.y2 - sheet.y2);
  return dx * h + dy * w;
}

/**
 * Pick a side for every name so that names keep off each other, off other
 * dots and on the sheet. Greedy, north to south: each name takes the
 * candidate with the least overlap, preferring the side away from the
 * nearer edge, then the opposite side, then above, then below.
 */
export function placeLabels(points: MapPoint[], width: number, height: number): void {
  const order = [...points].sort((a, b) => a.y - b.y);
  const placed: Box[] = [];
  const dots: Box[] = points.map((p) => ({ x1: p.x - DOT_R, y1: p.y - DOT_R, x2: p.x + DOT_R, y2: p.y + DOT_R }));
  const sheet: Box = { x1: 4, y1: 40, x2: width - 4, y2: height - 6 };
  for (const p of order) {
    const preferred: LabelSide = p.x < width / 2 ? 'right' : 'left';
    const candidates: LabelSide[] = [preferred, preferred === 'right' ? 'left' : 'right', 'above', 'below'];
    let chosen: LabelSide = preferred;
    let best = Infinity;
    for (const side of candidates) {
      const box = labelBox(p, side);
      let penalty = outsideArea(box, sheet) * 2;
      for (const b of placed) penalty += overlapArea(box, b);
      dots.forEach((d, i) => {
        if (points[i] !== p) penalty += overlapArea(box, d);
      });
      if (penalty < best) {
        best = penalty;
        chosen = side;
      }
      if (penalty === 0) break;
    }
    p.labelSide = chosen;
    placed.push(labelBox(p, chosen));
  }
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
