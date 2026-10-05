import { hexToCss, mix } from '../core/color';
import type { Postcard } from '../core/types';

/**
 * The little picture on a postcard: the sky of that moment, its sun or
 * moon and stars, hills or sea, weather, and a tiny wanderling on the path.
 * Plain SVG from the colours the card stored. Shapes are seeded by the
 * card id so every card is a slightly different drawing.
 */

const W = 300;
const H = 200;
const HORIZON = 0.6;
const INK = '#4A4A52';
const PAPER = '#F4EFE4';

export function renderPostcardScene(card: Postcard): string {
  const c = card.colors;
  const rng = seeded(hash(card.id));
  const uid = 'g' + hash(card.id).toString(36);
  const skyH = H * HORIZON;
  const sky = card.sky;
  const out: string[] = [];

  out.push(`<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hexToCss(c.skyTop)}"/><stop offset="1" stop-color="${hexToCss(c.skyHorizon)}"/></linearGradient></defs>`);
  out.push(`<rect width="${W}" height="${skyH + 1}" fill="url(#${uid})"/>`);

  // Stars.
  if (sky && sky.starAlpha > 0.05) {
    for (let i = 0; i < 40; i++) {
      out.push(`<circle cx="${(rng() * W).toFixed(1)}" cy="${(rng() * skyH * 0.85).toFixed(1)}" r="${(0.5 + rng() * 0.9).toFixed(2)}" fill="${PAPER}" opacity="${(sky.starAlpha * (0.5 + rng() * 0.5)).toFixed(2)}"/>`);
    }
  }
  // Sun or moon.
  if (sky?.sunUp) {
    const x = sky.sunX * W;
    const y = sky.sunY * skyH;
    const warm = sky.sunY > 0.75 ? '#F3C48C' : '#F8EBC0';
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22" fill="${warm}" opacity="0.18"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${warm}"/>`);
  } else if (sky?.moonUp) {
    const x = sky.moonX * W;
    const y = sky.moonY * skyH;
    const shade = hexToCss(mix(c.skyTop, c.skyHorizon, sky.moonY));
    const off = 18 * sky.moonFraction;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#ECE7D6"/>`);
    if (sky.moonFraction < 0.97) out.push(`<circle cx="${(x - off).toFixed(1)}" cy="${y.toFixed(1)}" r="9.2" fill="${shade}"/>`);
  }
  // Clouds: flat cut-outs, more of them the cloudier it was.
  const cloudN = sky ? Math.round(sky.cloud * 4) : card.weather && card.weather.condition !== 'clear' ? 2 : 0;
  const cloudColor = hexToCss(mix(mix(c.skyHorizon, PAPER, card.darkInk ? 0.7 : 0.25), c.skyTop, 0.1));
  for (let i = 0; i < cloudN; i++) {
    const cx = 20 + rng() * (W - 40);
    const cy = 20 + rng() * skyH * 0.5;
    const s = 10 + rng() * 10;
    out.push(`<g fill="${cloudColor}"><circle cx="${cx}" cy="${cy}" r="${s}"/><circle cx="${cx + s}" cy="${cy + 3}" r="${s * 0.8}"/><circle cx="${cx - s * 0.9}" cy="${cy + 4}" r="${s * 0.7}"/><rect x="${cx - s * 1.3}" y="${cy}" width="${s * 2.8}" height="${s * 0.6}"/></g>`);
  }

  // Land or sea: three ridges, far one flat water at the coast.
  const sea = card.seaAmount;
  const ridge = (base: number, amp: number, color: number, freq: number, phase: number): string => {
    const pts: string[] = [`0,${H}`];
    for (let x = 0; x <= W; x += 6) {
      const y = base + amp * Math.sin((x / W) * freq * Math.PI + phase) + amp * 0.4 * Math.sin((x / W) * freq * 2.3 * Math.PI + phase * 1.7);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    pts.push(`${W},${H}`);
    const stroke = hexToCss(mix(color, INK, 0.4));
    return `<polygon points="${pts.join(' ')}" fill="${hexToCss(color)}"/><polyline points="${pts.slice(1, -1).join(' ')}" fill="none" stroke="${stroke}" stroke-width="0.8" opacity="0.5"/>`;
  };
  if (sea > 0.5) {
    out.push(`<rect x="0" y="${skyH - 4}" width="${W}" height="${H * 0.14}" fill="${hexToCss(c.sea)}"/>`);
    const wave = hexToCss(mix(c.sea, PAPER, 0.5));
    for (let i = 0; i < 7; i++) {
      const x = rng() * W;
      const y = skyH + 2 + rng() * H * 0.1;
      out.push(`<path d="M${x.toFixed(0)} ${y.toFixed(0)} q5 -2 10 0 t10 0" fill="none" stroke="${wave}" stroke-width="1" opacity="0.6"/>`);
    }
    out.push(ridge(skyH + H * 0.12, 5, c.hillNear, 2.2, rng() * 6));
  } else {
    out.push(ridge(skyH - 10, 14, c.hillFar, 1.7, rng() * 6));
    out.push(ridge(skyH + 6, 9, mix(c.hillFar, c.hillNear, 0.5), 2.6, rng() * 6));
    out.push(ridge(skyH + 18, 5, c.hillNear, 3.4, rng() * 6));
  }
  // Ground and the path.
  out.push(`<rect x="0" y="${skyH + H * 0.22}" width="${W}" height="${H}" fill="${hexToCss(c.ground)}"/>`);
  const py = skyH + H * 0.3;
  out.push(`<path d="M0 ${py + 10} Q${W / 2} ${py - 6} ${W} ${py + 4} L${W} ${py + 14} Q${W / 2} ${py + 6} 0 ${py + 20} Z" fill="${hexToCss(mix(c.ground, PAPER, 0.4))}" stroke="${hexToCss(mix(c.ground, INK, 0.35))}" stroke-width="0.6" opacity="0.95"/>`);
  // A tiny wanderling, seen from behind, on the path: bean body, leaf, scarf, backpack.
  const tx = W * 0.6;
  const ty = py + 12;
  const body = card.darkInk ? '#F1E9D6' : '#D9D1BC';
  out.push(
    `<g><rect x="${tx - 1.6}" y="${ty - 3.5}" width="1.5" height="3.5" rx="0.6" fill="#4F5566"/><rect x="${tx + 0.3}" y="${ty - 3.5}" width="1.5" height="3.5" rx="0.6" fill="#4F5566"/>` +
      `<path d="M${tx} ${ty - 14} C${tx + 4} ${ty - 14} ${tx + 5.2} ${ty - 9} ${tx + 5} ${ty - 6} C${tx + 4.8} ${ty - 3.2} ${tx - 4.8} ${ty - 3.2} ${tx - 5} ${ty - 6} C${tx - 5.2} ${ty - 9} ${tx - 4} ${ty - 14} ${tx} ${ty - 14}Z" fill="${body}" stroke="${INK}" stroke-width="0.5"/>` +
      `<rect x="${tx - 3.4}" y="${ty - 11.5}" width="6.8" height="6.5" rx="1.6" fill="#A48A6A" stroke="${INK}" stroke-width="0.4"/>` +
      `<path d="M${tx - 5} ${ty - 9.6} Q${tx} ${ty - 8.4} ${tx + 5} ${ty - 9.6} L${tx + 5} ${ty - 8.4} Q${tx} ${ty - 7.2} ${tx - 5} ${ty - 8.4}Z" fill="#B86B5A"/>` +
      `<path d="M${tx + 0.3} ${ty - 14} q-0.3 -1 0.2 -1.6 q2 -2.2 1.6 -4.6 q-3 1.6 -2.6 4.6 q0.2 1 0.8 1.6Z" fill="#7E9A8C" stroke="${INK}" stroke-width="0.35"/></g>`,
  );

  // Weather over everything.
  const cond = card.weather?.condition;
  if (cond && /rain|drizzle|thunder/.test(cond)) {
    const n = cond === 'drizzle' ? 25 : 55;
    const col = hexToCss(mix(c.skyHorizon, PAPER, 0.5));
    for (let i = 0; i < n; i++) {
      const x = rng() * W;
      const y = rng() * H;
      out.push(`<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 1.5).toFixed(0)}" y2="${(y + 7).toFixed(0)}" stroke="${col}" stroke-width="0.8" opacity="0.6"/>`);
    }
  } else if (cond && /snow/.test(cond)) {
    for (let i = 0; i < 45; i++) {
      out.push(`<circle cx="${(rng() * W).toFixed(0)}" cy="${(rng() * H).toFixed(0)}" r="${(0.8 + rng() * 1.2).toFixed(1)}" fill="${PAPER}" opacity="0.85"/>`);
    }
  } else if (cond === 'fog') {
    out.push(`<rect x="0" y="${skyH - 20}" width="${W}" height="60" fill="${hexToCss(mix(c.skyHorizon, PAPER, 0.5))}" opacity="0.45"/>`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
