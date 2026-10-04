import { describeProgress, layoutRoute, mapProgress, wobble, type MapLayout, type XY } from '../core/map';
import type { Position, Postcard, Route } from '../core/types';

export interface FootprintMap {
  open(): void;
  close(): void;
  update(route: Route, pos: Position | null, cards: Postcard[]): void;
  readonly isOpen: boolean;
}

const INK = '#4A4A52';
const PAPER = '#F4EFE4';
const BRICK = '#B86B5A';
const SEA = '#7C9DB0';
const GLOW = '#F8EBC0';

/**
 * The footprint map: the route drawn on a sheet of paper, walked stretch in
 * brick red, places lit as they are reached, the wanderer as a small dot.
 * Plain SVG built from strings; nothing here is interactive beyond closing.
 */
export function createMap(root: HTMLElement): FootprintMap {
  const el = document.createElement('div');
  el.className = 'album map-sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">Map</div>
        <button class="pill map-close" type="button">Close</button>
      </div>
      <div class="map-paper" id="map-paper"></div>
      <p class="map-progress" id="map-progress"></p>
    </div>
  `;
  root.appendChild(el);
  const paper = el.querySelector<HTMLDivElement>('#map-paper')!;
  const progress = el.querySelector<HTMLParagraphElement>('#map-progress')!;
  const closeBtn = el.querySelector<HTMLButtonElement>('.map-close')!;

  let layout: MapLayout | null = null;
  let layoutFor: string | null = null;

  const api: FootprintMap = {
    open() {
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('open'));
    },
    close() {
      el.classList.remove('open');
      window.setTimeout(() => {
        if (!el.classList.contains('open')) el.hidden = true;
      }, 350);
    },
    update(route, pos, cards) {
      if (!layout || layoutFor !== route.id) {
        layout = layoutRoute(route);
        layoutFor = route.id;
      }
      const p = mapProgress(layout, pos);
      paper.innerHTML = renderSvg(route, layout, p, new Set(cards.map((c) => c.placeId)));
      progress.textContent = describeProgress(p);
    },
    get isOpen() {
      return !el.hidden;
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  el.addEventListener('click', (e) => {
    if (e.target === el) api.close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && api.isOpen) api.close();
  });
  return api;
}

function renderSvg(route: Route, layout: MapLayout, p: ReturnType<typeof mapProgress>, stamped: Set<string>): string {
  const { width: W, height: H } = layout;
  const reached = new Set(p.reached);
  const pts = (path: XY[]): string => wobble(path).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');

  // A little sea below the coast places, but not where another coast place's
  // label would sit right on top of it.
  const coast = layout.points.filter((q) => q.terrain === 'coast' || q.terrain === 'lake');
  const seaMarks = coast
    .filter((q) => !coast.some((o) => o !== q && o.y > q.y && o.y - q.y < 70 && Math.abs(o.x - q.x) < 160))
    .map((q) => {
      const rows = [14, 24, 34];
      return rows
        .map((dy, i) => {
          const x0 = q.x - 26 + i * 4;
          const y = q.y + dy;
          return `<path d="M${x0} ${y} q6 -4 12 0 t12 0 t12 0 t12 0" fill="none" stroke="${SEA}" stroke-width="1.4" stroke-linecap="round" opacity="${0.8 - i * 0.2}"/>`;
        })
        .join('');
    })
    .join('');

  const ahead = p.ahead.length > 1 ? `<polyline points="${pts(p.ahead)}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>` : '';
  const walked = p.walked.length > 1 ? `<polyline points="${pts(p.walked)}" fill="none" stroke="${BRICK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : '';

  const places = layout.points
    .map((q) => {
      const lit = reached.has(q.id);
      const dot = lit
        ? `<circle cx="${q.x}" cy="${q.y}" r="5" fill="${BRICK}" stroke="${INK}" stroke-width="1.2"/>`
        : `<circle cx="${q.x}" cy="${q.y}" r="4.5" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" opacity="0.8"/>`;
      const stamp = lit && stamped.has(q.id) ? `<text x="${q.x + (q.labelSide === 'right' ? -11 : 11)}" y="${q.y + 4}" font-size="9" fill="${BRICK}" text-anchor="middle" opacity="0.9">✦</text>` : '';
      const tx = q.labelSide === 'right' ? q.x + 10 : q.x - 10;
      const anchor = q.labelSide === 'right' ? 'start' : 'end';
      const label = `<text x="${tx}" y="${q.y + 4}" font-size="12.5" fill="${INK}" text-anchor="${anchor}" opacity="${lit ? 1 : 0.55}">${escape(q.name)}</text>`;
      return dot + stamp + label;
    })
    .join('');

  const walker = `<circle cx="${p.current.x}" cy="${p.current.y}" r="9" fill="${GLOW}" opacity="0.7"/><circle cx="${p.current.x}" cy="${p.current.y}" r="3.6" fill="${INK}"/>`;

  const title = `<text x="22" y="30" font-size="15" letter-spacing="2" fill="${INK}" opacity="0.85">${escape(route.name.toUpperCase())}</text>`;
  const compass = `<g transform="translate(${W - 30} 34)"><line x1="0" y1="12" x2="0" y2="-10" stroke="${INK}" stroke-width="1.2"/><path d="M-4 -4 L0 -12 L4 -4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><text x="0" y="26" font-size="10" fill="${INK}" text-anchor="middle" opacity="0.8">N</text></g>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="1" opacity="1"/>
    <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="3" fill="none" stroke="${INK}" stroke-width="0.6" opacity="0.35"/>
    ${title}${compass}${seaMarks}${ahead}${walked}${places}${walker}
  </svg>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
