import { formatKm, routeName, t } from '../core/i18n';
import type { RouteOption } from '../core/chain';
import { LABEL_FONT, describeProgress, layoutRoute, mapProgress, wobble, type LabelSide, type MapLayout, type XY } from '../core/map';
import type { Position, Postcard, Route } from '../core/types';

export interface FootprintMap {
  open(): void;
  close(): void;
  update(route: Route, pos: Position | null, cards: Postcard[], options?: RouteOption[]): void;
  readonly isOpen: boolean;
}

export interface MapHandlers {
  /** The person tapped a route for next; null when they tapped the chosen one again. */
  onChoose?: (routeId: string | null) => void;
}

const INK = '#4A4A52';
const PAPER = '#F4EFE4';
const BRICK = '#B86B5A';
const SEA = '#7C9DB0';
const GLOW = '#F8EBC0';

/**
 * The footprint map: the route drawn on a sheet of paper, walked stretch in
 * brick red, places lit as they are reached, the wanderling as a tiny figure.
 * Plain SVG built from strings; nothing here is interactive beyond closing.
 */
export function createMap(root: HTMLElement, handlers: MapHandlers = {}): FootprintMap {
  const el = document.createElement('div');
  el.className = 'album map-sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="album-inner">
      <div class="album-head">
        <div class="album-title">${t('map')}</div>
        <button class="pill map-close" type="button">${t('close')}</button>
      </div>
      <div class="map-paper" id="map-paper"></div>
      <p class="map-progress" id="map-progress"></p>
      <div class="map-next">
        <div class="map-next-title">${t('nextRoute')}</div>
        <p class="map-next-hint">${t('nextHint')}</p>
        <div class="map-routes" id="map-routes"></div>
      </div>
    </div>
  `;
  root.appendChild(el);
  const paper = el.querySelector<HTMLDivElement>('#map-paper')!;
  const progress = el.querySelector<HTMLParagraphElement>('#map-progress')!;
  const routesEl = el.querySelector<HTMLDivElement>('#map-routes')!;
  routesEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-route]');
    if (!btn || btn.disabled) return;
    handlers.onChoose?.(btn.classList.contains('chosen') ? null : btn.dataset.route!);
  });
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
    update(route, pos, cards, options) {
      if (options) routesEl.innerHTML = options.map(renderOption).join('');
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
      const stampX = q.labelSide === 'right' ? q.x - 11 : q.labelSide === 'left' ? q.x + 11 : q.x + 11;
      const stamp = lit && stamped.has(q.id) ? `<text x="${stampX}" y="${q.y + 4}" font-size="9" fill="${BRICK}" text-anchor="middle" opacity="0.9">✦</text>` : '';
      const { tx, ty, anchor } = labelPos(q.x, q.y, q.labelSide);
      const label = `<text x="${tx}" y="${ty}" font-size="${LABEL_FONT}" fill="${INK}" text-anchor="${anchor}" opacity="${lit ? 1 : 0.55}">${escape(q.name)}</text>`;
      return dot + stamp + label;
    })
    .join('');

  // The wanderling: a small cream bean with a leaf and a red scarf, in a soft glow.
  const wx = p.current.x;
  const wy = p.current.y;
  const walker =
    `<circle cx="${wx}" cy="${wy}" r="9" fill="${GLOW}" opacity="0.7"/>` +
    `<path d="M${wx} ${wy - 5} C${wx + 3.2} ${wy - 5} ${wx + 4.2} ${wy - 1.5} ${wx + 4} ${wy + 1} C${wx + 3.8} ${wy + 3.4} ${wx - 3.8} ${wy + 3.4} ${wx - 4} ${wy + 1} C${wx - 4.2} ${wy - 1.5} ${wx - 3.2} ${wy - 5} ${wx} ${wy - 5}Z" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M${wx - 3.6} ${wy + 0.2} Q${wx} ${wy + 1.6} ${wx + 3.6} ${wy + 0.2}" fill="none" stroke="${BRICK}" stroke-width="1.6"/>` +
    `<path d="M${wx + 0.2} ${wy - 5} q0 -1.2 0.6 -1.8 q1.8 -1.4 1.4 -3.4 q-2.4 1.2 -2.2 3.6 q0 1 0.2 1.6Z" fill="#7E9A8C" stroke="${INK}" stroke-width="0.5"/>` +
    `<circle cx="${wx - 1.2}" cy="${wy - 1.6}" r="0.6" fill="${INK}"/><circle cx="${wx + 1.2}" cy="${wy - 1.6}" r="0.6" fill="${INK}"/>`;

  const title = `<text x="22" y="30" font-size="15" letter-spacing="2" fill="${INK}" opacity="0.85">${escape(routeName(route).toUpperCase())}</text>`;
  const compass = `<g transform="translate(${W - 30} 34)"><line x1="0" y1="12" x2="0" y2="-10" stroke="${INK}" stroke-width="1.2"/><path d="M-4 -4 L0 -12 L4 -4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><text x="0" y="26" font-size="10" fill="${INK}" text-anchor="middle" opacity="0.8">N</text></g>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="1" opacity="1"/>
    <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="3" fill="none" stroke="${INK}" stroke-width="0.6" opacity="0.35"/>
    ${title}${compass}${seaMarks}${ahead}${walked}${places}${walker}
  </svg>`;
}

function renderOption(o: RouteOption): string {
  const how = o.current ? t('walkingNow') : t(o.mode === 'fly' ? 'byPlane' : o.mode === 'ride' ? 'byTrain' : 'byFoot', { km: formatKm(o.km) });
  const tag = o.chosen ? `<span class="map-route-tag">${t('chosenNext')}</span>` : o.walked && !o.current ? `<span class="map-route-tag muted">✓ ${t('walkedDone')}</span>` : '';
  const cls = ['map-route', o.current ? 'current' : '', o.chosen ? 'chosen' : '', o.walked ? 'walked' : ''].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}" data-route="${o.route.id}" ${o.current ? 'disabled' : ''}><span class="map-route-name">${escape(routeName(o.route))}</span><span class="map-route-how">${how}</span>${tag}</button>`;
}

function labelPos(x: number, y: number, side: LabelSide): { tx: number; ty: number; anchor: string } {
  switch (side) {
    case 'right':
      return { tx: x + 10, ty: y + 4, anchor: 'start' };
    case 'left':
      return { tx: x - 10, ty: y + 4, anchor: 'end' };
    case 'above':
      return { tx: x, ty: y - 11, anchor: 'middle' };
    default:
      return { tx: x, ty: y + 20, anchor: 'middle' };
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
