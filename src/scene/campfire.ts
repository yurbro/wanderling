import { Container, Graphics } from 'pixi.js';
import { PROPS } from '../core/palette';
import { hexToRgb, rgbToHex } from '../core/color';

const hex = (s: string): number => {
  const c = hexToRgb(s);
  return rgbToHex(c);
};

const WOOD = hex(PROPS.wood);
const EMBER = 0xd9945a;
const FLAME = 0xeab878;
const CORE = 0xf8ebc0;

/**
 * Bedtime mode's campfire: two crossed logs, a few teardrop flames that
 * flicker out of step, a soft glow on the ground, and a spark or two. The
 * colours are muted ambers, so the scarf stays the one saturated thing.
 * `level` is 0..1 from the render state; it sinks to embers once he sleeps.
 */
export class Campfire {
  readonly view = new Container();
  private readonly glow = new Graphics();
  private readonly body = new Graphics();
  private readonly sparks = new Graphics();
  private time = 0;

  constructor() {
    this.view.addChild(this.glow, this.body, this.sparks);
    this.view.visible = false;
  }

  /** Draw one frame. `u` is the wanderling's unit in pixels; (x, y) is where the fire sits on the ground. */
  frame(dt: number, level: number, x: number, y: number, u: number): void {
    this.time += dt;
    this.view.visible = level > 0.01;
    if (!this.view.visible) return;
    const t = this.time;
    const flicker = 0.9 + 0.1 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);

    this.glow.clear();
    this.glow.ellipse(x, y, 2.2 * u * level, 0.5 * u * level).fill({ color: EMBER, alpha: 0.1 * flicker });
    this.glow.ellipse(x, y - 0.1 * u, 1.3 * u * level, 0.32 * u * level).fill({ color: FLAME, alpha: 0.16 * flicker });
    this.glow.circle(x, y - 0.35 * u, 0.9 * u * level).fill({ color: CORE, alpha: 0.07 * flicker });

    const g = this.body;
    g.clear();
    // Logs, crossed low.
    g.roundRect(x - 0.42 * u, y - 0.1 * u, 0.84 * u, 0.13 * u, 0.05 * u).fill({ color: WOOD });
    g.roundRect(x - 0.34 * u, y - 0.2 * u, 0.7 * u, 0.12 * u, 0.05 * u).fill({ color: 0x6f5a42 });
    // Flames: three teardrops, taller with the level.
    const tongues = [
      { dx: -0.14, h: 0.5, w: 0.16, ph: 0 },
      { dx: 0.12, h: 0.62, w: 0.18, ph: 1.7 },
      { dx: 0.0, h: 0.78, w: 0.2, ph: 3.1 },
    ];
    for (const f of tongues) {
      const sway = Math.sin(t * 6 + f.ph) * 0.05 * u;
      const h = f.h * u * level * (0.88 + 0.12 * Math.sin(t * 8 + f.ph * 2));
      const w = f.w * u;
      const bx = x + f.dx * u;
      const by = y - 0.12 * u;
      g.moveTo(bx - w / 2, by)
        .quadraticCurveTo(bx - w / 2 + sway * 0.5, by - h * 0.55, bx + sway, by - h)
        .quadraticCurveTo(bx + w / 2 + sway * 0.5, by - h * 0.55, bx + w / 2, by)
        .closePath()
        .fill({ color: FLAME, alpha: 0.9 });
      g.ellipse(bx + sway * 0.3, by - h * 0.22, w * 0.22, h * 0.2).fill({ color: CORE, alpha: 0.85 });
    }

    // A couple of sparks drifting up, only while the fire is high.
    const s = this.sparks;
    s.clear();
    if (level > 0.5) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        const sx = x + Math.sin(t * 1.3 + i * 2.1) * 0.25 * u;
        const sy = y - 0.3 * u - k * 1.3 * u;
        s.circle(sx, sy, 0.018 * u).fill({ color: CORE, alpha: (1 - k) * 0.8 });
      }
    }
  }
}
