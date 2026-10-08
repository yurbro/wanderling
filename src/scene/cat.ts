import { Graphics } from 'pixi.js';

/**
 * The cat that follows the wanderling on the first week's day 2 (review v2,
 * section 4). A small paper-cut shape in a dull warm grey, so the scarf
 * stays the one saturated thing; drawn in code like the far silhouettes.
 * It walks a little way behind him, and sits when he stops.
 */

const FUR = 0x5f5955;
const BELLY = 0x77706b;
const EYE = 0xd8cfae;
/** The same soft ink as the wanderling's outline. */
const INK = 0x3a393d;

export class CatPainter {
  readonly view = new Graphics();
  private stride = 0;
  /** 0 walking, 1 sitting; eased so it settles rather than snaps. */
  private sit = 0;
  private sway = 0;

  /**
   * `x`/`feetY`: where it stands; `size`: its body length in px; `strength`:
   * 0..1 from the surprise engine (it slips in from the left as it rises).
   */
  frame(dt: number, o: { x: number; feetY: number; size: number; strength: number; walking: boolean; tint: number; width: number }): void {
    const g = this.view;
    g.clear();
    if (o.strength <= 0.005) {
      g.visible = false;
      return;
    }
    g.visible = true;
    if (o.walking) this.stride += dt * 7.5;
    this.sway += dt;
    this.sit += ((o.walking ? 0 : 1) - this.sit) * Math.min(1, dt * 2.5);
    g.position.set(o.x - (1 - Math.min(1, o.strength * 1.4)) * o.width * 0.4, o.feetY);
    g.alpha = Math.min(1, o.strength * 1.8);
    g.tint = o.tint;

    const s = o.size;
    const k = this.sit;
    const lerp = (a: number, b: number): number => a + (b - a) * k;
    const bob = o.walking ? Math.abs(Math.sin(this.stride)) * s * 0.025 : 0;
    const line = Math.max(1.2, s * 0.028);
    const inked = (color: number, width: number) => ({ width, color, cap: 'round' as const });

    // Legs first, behind the body: four short ones when walking, the front two when sat.
    const legW = s * 0.11;
    const hip = { x: lerp(-0.3, -0.1) * s, y: lerp(-0.3, -0.12) * s - bob };
    const shoulder = { x: lerp(0.28, 0.14) * s, y: lerp(-0.3, -0.3) * s - bob };
    const swing = (phase: number): number => (o.walking ? Math.sin(this.stride + phase) * s * 0.1 : 0);
    const leg = (from: { x: number; y: number }, phase: number, shade: number): void => {
      const foot = from.x + swing(phase);
      g.moveTo(from.x, from.y).lineTo(foot, -legW * 0.4).stroke(inked(INK, legW + line * 2));
      g.moveTo(from.x, from.y).lineTo(foot, -legW * 0.4).stroke(inked(shade, legW));
    };
    if (k < 0.6) {
      leg(hip, Math.PI, BELLY);
      leg(shoulder, 0, BELLY);
    }
    leg(hip, 0, FUR);
    leg(shoulder, Math.PI, FUR);

    // The tail: up and curling at the tip, swaying slowly; curled round the feet when sat.
    const tailBase = { x: lerp(-0.44, -0.24) * s, y: lerp(-0.4, -0.08) * s - bob };
    const tip = Math.sin(this.sway * 1.6) * s * 0.1;
    const tail = (): Graphics =>
      g
        .moveTo(tailBase.x, tailBase.y)
        .bezierCurveTo(
          tailBase.x - s * 0.22,
          tailBase.y - s * lerp(0.08, -0.04),
          tailBase.x - s * lerp(0.26, 0.4),
          tailBase.y - s * lerp(0.42, 0.0),
          tailBase.x - s * lerp(0.1, 0.3) + tip,
          tailBase.y - s * lerp(0.6, 0.08),
        );
    tail().stroke(inked(INK, s * 0.075 + line * 2));
    tail().stroke(inked(FUR, s * 0.075));

    // Body: long and low when walking, an upright pear when sat.
    g.ellipse(lerp(0, -0.02) * s, lerp(-0.4, -0.3) * s - bob, lerp(0.44, 0.26) * s, lerp(0.17, 0.28) * s)
      .fill({ color: FUR })
      .stroke({ width: line, color: INK });

    // Head, ears, one eye (seen side-on).
    const hx = lerp(0.46, 0.14) * s;
    const hy = lerp(-0.56, -0.68) * s - bob;
    const r = s * 0.17;
    g.poly([hx - r * 0.85, hy - r * 0.35, hx - r * 0.55, hy - r * 1.4, hx - r * 0.05, hy - r * 0.75]).fill({ color: FUR }).stroke({ width: line, color: INK, join: 'round' });
    g.poly([hx + r * 0.05, hy - r * 0.8, hx + r * 0.55, hy - r * 1.4, hx + r * 0.85, hy - r * 0.3]).fill({ color: FUR }).stroke({ width: line, color: INK, join: 'round' });
    g.circle(hx, hy, r).fill({ color: FUR }).stroke({ width: line, color: INK });
    g.circle(hx + r * 0.45, hy - r * 0.1, r * 0.14).fill({ color: EYE });
  }
}
