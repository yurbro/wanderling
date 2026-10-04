import { Container, Graphics } from 'pixi.js';
import { mix, smoothstep } from '../core/color';
import { PROPS, WANDERER } from '../core/palette';
import type { RenderState } from '../core/types';

/**
 * What makes the coast feel like the coast: a few wave strokes drifting on
 * the water, a ferry and a sailing boat crossing slowly, gulls in the sky.
 * Everything fades in with `land.sea`, so it only shows near the shore.
 */

interface Wave {
  x: number;
  y: number;
  len: number;
  phase: number;
}

interface Boat {
  view: Container;
  x: number;
  y: number;
  speed: number;
  width: number;
}

interface Gull {
  x: number;
  y: number;
  phase: number;
  flap: number;
  speed: number;
  size: number;
}

export class SeaPainter {
  /** Short light strokes on the water. Add above the mid hills. */
  readonly waves = new Graphics();
  /** Boats on the water, same layer as the waves. */
  readonly boats = new Container();
  /** Gulls in the sky. Add above the clouds. */
  readonly gulls = new Graphics();

  private w = 1;
  private h = 1;
  private waveList: Wave[] = [];
  private boatList: Boat[] = [];
  private gullList: Gull[] = [];
  private amount = 0;
  private daylight = 1;
  private waveColor = 0xffffff;
  private rng = seeded(31);

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.rng = seeded(31);
    const rng = this.rng;
    const top = h * 0.548;
    const bottom = h * 0.596;
    this.waveList = Array.from({ length: 11 }, () => ({
      x: rng() * w,
      y: top + rng() * (bottom - top),
      len: 10 + rng() * 18,
      phase: rng() * Math.PI * 2,
    }));

    this.boats.removeChildren();
    const k = w / 390;
    const ferry = new Container();
    drawFerry(ferry, k * 0.85);
    const sail = new Container();
    drawSailboat(sail, k);
    this.boatList = [
      { view: ferry, x: w * 0.7, y: h * 0.562, speed: -3.2 * k, width: 40 * k },
      { view: sail, x: w * 0.25, y: h * 0.584, speed: 2.1 * k, width: 24 * k },
    ];
    for (const b of this.boatList) this.boats.addChild(b.view);

    this.gullList = Array.from({ length: 4 }, (_, i) => ({
      x: rng() * w,
      y: h * (0.3 + rng() * 0.17),
      phase: rng() * Math.PI * 2,
      flap: 2.2 + rng() * 1.6,
      speed: -(7 + rng() * 7) * k,
      size: (3.5 + rng() * 2 + (i === 0 ? 1.5 : 0)) * k,
    }));
  }

  setState(rs: RenderState): void {
    this.amount = smoothstep(0.35, 0.85, rs.land.sea);
    this.daylight = rs.light;
    this.waveColor = mix(rs.land.seaNear, WANDERER.glow, 0.55);
    for (const b of this.boatList) b.view.tint = rs.wanderer.tint;
    const show = this.amount > 0.01;
    this.waves.visible = show;
    this.boats.visible = show;
    this.gulls.visible = show && this.daylight > 0.45;
    this.boats.alpha = this.amount;
  }

  frame(dt: number, elapsed: number): void {
    if (this.amount <= 0.01) return;
    const { w } = this;

    // Waves: slow drift, gentle twinkle.
    const g = this.waves;
    g.clear();
    for (const wv of this.waveList) {
      wv.x += 3 * dt;
      if (wv.x > w + 30) wv.x -= w + 60;
      const a = (0.3 + 0.18 * Math.sin(elapsed * 0.9 + wv.phase)) * this.amount;
      g.moveTo(wv.x, wv.y).quadraticCurveTo(wv.x + wv.len / 2, wv.y - 1.2, wv.x + wv.len, wv.y);
      g.stroke({ color: this.waveColor, width: 1.2, alpha: a, cap: 'round' });
    }

    // Boats: cross the water and come back round after a long while.
    for (const b of this.boatList) {
      b.x += b.speed * dt;
      if (b.speed < 0 && b.x < -b.width) b.x = w + b.width + this.rng() * w;
      if (b.speed > 0 && b.x > w + b.width) b.x = -b.width - this.rng() * w;
      b.view.position.set(b.x, b.y + Math.sin(elapsed * 1.3 + b.x * 0.05) * 0.6);
    }

    // Gulls: a flapping V, drifting with the wind off the sea.
    if (!this.gulls.visible) return;
    const gg = this.gulls;
    gg.clear();
    for (const gull of this.gullList) {
      gull.x += gull.speed * dt;
      if (gull.x < -20) {
        gull.x = w + 20 + this.rng() * 80;
        gull.y = this.h * (0.3 + this.rng() * 0.17);
      }
      const y = gull.y + Math.sin(elapsed * 0.7 + gull.phase) * 4;
      const wing = Math.sin(elapsed * gull.flap + gull.phase) * gull.size * 0.7;
      const s = gull.size;
      gg.moveTo(gull.x - s, y - wing)
        .quadraticCurveTo(gull.x - s * 0.4, y + s * 0.3 - wing * 0.3, gull.x, y)
        .quadraticCurveTo(gull.x + s * 0.4, y + s * 0.3 - wing * 0.3, gull.x + s, y - wing);
    }
    gg.stroke({ color: WANDERER.ink, width: 1.1, alpha: 0.7 * this.amount * smoothstep(0.45, 0.75, this.daylight), cap: 'round' });
  }
}

/** A small ferry seen from the side, waterline at y = 0, drawn in local pixels. */
function drawFerry(view: Container, k: number): void {
  const g = new Graphics();
  const line = { color: WANDERER.ink, width: 1 * k, join: 'round' as const };
  g.moveTo(-18 * k, 0).lineTo(18 * k, 0).lineTo(15 * k, -5 * k).lineTo(-16 * k, -5 * k).closePath().fill({ color: PROPS.hull }).stroke(line);
  g.rect(-10 * k, -11 * k, 18 * k, 6 * k).fill({ color: PROPS.sail }).stroke(line);
  g.rect(2 * k, -15 * k, 4 * k, 4 * k).fill({ color: PROPS.funnel }).stroke(line);
  for (const x of [-7, -3, 1, 5]) g.rect(x * k, -9.5 * k, 2 * k, 2 * k).fill({ color: PROPS.window });
  view.addChild(g);
}

/** A sailing boat, waterline at y = 0. */
function drawSailboat(view: Container, k: number): void {
  const g = new Graphics();
  const line = { color: WANDERER.ink, width: 1 * k, join: 'round' as const };
  g.moveTo(-9 * k, 0).lineTo(9 * k, 0).lineTo(7 * k, -3 * k).lineTo(-8 * k, -3 * k).closePath().fill({ color: PROPS.hullDark });
  g.moveTo(0, -3 * k).lineTo(0, -17 * k).stroke(line);
  g.moveTo(0.8 * k, -16 * k).lineTo(0.8 * k, -4 * k).lineTo(8.5 * k, -4 * k).closePath().fill({ color: PROPS.sail }).stroke(line);
  g.moveTo(-0.8 * k, -14 * k).lineTo(-0.8 * k, -5 * k).lineTo(-5 * k, -5 * k).closePath().fill({ color: PROPS.sail }).stroke(line);
  view.addChild(g);
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
