import { Application, Container, FillGradient, Graphics } from 'pixi.js';
import { mix } from '../core/color';
import { CELESTIAL } from '../core/palette';
import type { RenderState } from '../core/types';

/** Fraction of the screen height where the sky meets the land. */
const HORIZON = 0.62;

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  g: Graphics;
}

interface HillSpec {
  /** Baseline as a fraction of height, measured from the top. */
  base: number;
  /** Wave amplitudes as fractions of height. */
  amps: number[];
  /** Wave frequencies in radians per pixel, scaled by width. */
  freqs: number[];
  phases: number[];
}

/**
 * Draws the scene from a RenderState. All layout is proportional so the same
 * code works on a phone in portrait and in a desktop browser.
 *
 * Layer order, back to front: sky, stars, sun, moon, far hills, mid hills,
 * near hills, ground + path.
 */
export class SceneRenderer {
  private app = new Application();
  private sky = new Graphics();
  private starLayer = new Container();
  private stars: Star[] = [];
  private sunHalo = new Graphics();
  private sunDisc = new Graphics();
  private moonDisc = new Graphics();
  private moonShadow = new Graphics();
  private hillFar = new Graphics();
  private hillMid = new Graphics();
  private hillNear = new Graphics();
  private ground = new Graphics();
  private state: RenderState | null = null;
  private w = 1;
  private h = 1;
  private elapsed = 0;
  private paused = false;

  private readonly hillSpecs: Record<'far' | 'mid' | 'near', HillSpec> = {
    far: { base: 0.52, amps: [0.045, 0.02, 0.008], freqs: [1.7, 4.1, 9.3], phases: [0.4, 2.1, 5.2] },
    mid: { base: 0.565, amps: [0.03, 0.014, 0.006], freqs: [2.3, 5.9, 11.7], phases: [1.9, 0.3, 3.8] },
    near: { base: 0.6, amps: [0.014, 0.008, 0.004], freqs: [3.1, 7.7, 15.1], phases: [4.2, 1.1, 2.6] },
  };

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      antialias: true,
      background: 0x1c2240,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    this.app.ticker.maxFPS = 30;
    this.app.canvas.classList.add('scene');
    parent.appendChild(this.app.canvas);

    this.app.stage.addChild(
      this.sky,
      this.starLayer,
      this.sunHalo,
      this.sunDisc,
      this.moonDisc,
      this.moonShadow,
      this.hillFar,
      this.hillMid,
      this.hillNear,
      this.ground,
    );

    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
  }

  setState(state: RenderState): void {
    this.state = state;
    this.redraw();
  }

  pause(): void {
    this.paused = true;
    this.app.ticker.stop();
  }

  resume(): void {
    this.paused = false;
    this.app.ticker.start();
  }

  /** Current canvas size, handy for tests and tooling. */
  get size(): { w: number; h: number } {
    return { w: this.w, h: this.h };
  }

  private layout(): void {
    this.w = Math.max(1, this.app.screen.width);
    this.h = Math.max(1, this.app.screen.height);
    this.makeStars();
    this.redraw();
  }

  private makeStars(): void {
    this.starLayer.removeChildren();
    this.stars = [];
    const rng = seeded(7);
    const count = Math.round(70 + this.w / 6);
    const skyH = this.h * HORIZON;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const r = 0.6 + rng() * 1.2;
      g.circle(0, 0, r).fill({ color: CELESTIAL.star });
      const star: Star = {
        x: rng() * this.w,
        y: rng() * skyH * 0.9,
        r,
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 1.2,
        g,
      };
      g.position.set(star.x, star.y);
      this.starLayer.addChild(g);
      this.stars.push(star);
    }
  }

  private frame(deltaMS: number): void {
    if (this.paused || !this.state) return;
    this.elapsed += deltaMS / 1000;
    const base = this.state.starAlpha;
    if (base <= 0.001) {
      if (this.starLayer.visible) this.starLayer.visible = false;
      return;
    }
    this.starLayer.visible = true;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.elapsed * s.speed + s.phase);
      s.g.alpha = base * tw;
    }
  }

  private redraw(): void {
    const st = this.state;
    if (!st) return;
    const { w, h } = this;
    const skyH = h * HORIZON;

    // Sky: three-stop vertical gradient.
    this.sky.clear();
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: st.sky.top },
        { offset: 0.55, color: st.sky.mid },
        { offset: 1, color: st.sky.horizon },
      ],
      textureSpace: 'local',
    });
    this.sky.rect(0, 0, w, skyH + 2).fill(gradient);

    // Sun.
    const unit = Math.min(w, h);
    const sunR = unit * 0.045;
    const sunColor = mix(CELESTIAL.sunDay, CELESTIAL.sunLow, st.sun.warmth);
    this.sunDisc.clear();
    this.sunHalo.clear();
    if (st.sun.visible) {
      const sx = st.sun.x * w;
      const sy = st.sun.y * skyH;
      this.sunHalo.circle(sx, sy, sunR * 2.6).fill({ color: sunColor, alpha: 0.14 });
      this.sunHalo.circle(sx, sy, sunR * 1.6).fill({ color: sunColor, alpha: 0.16 });
      this.sunDisc.circle(sx, sy, sunR).fill({ color: sunColor });
    }

    // Moon with a simple phase shadow (a sky-colored disc slid across it).
    const moonR = unit * 0.034;
    this.moonDisc.clear();
    this.moonShadow.clear();
    const moonVisible = st.moon.visible && st.starAlpha > 0.02;
    if (moonVisible) {
      const mx = st.moon.x * w;
      const my = st.moon.y * skyH;
      const alpha = Math.min(1, 0.25 + st.starAlpha);
      this.moonDisc.circle(mx, my, moonR).fill({ color: CELESTIAL.moon, alpha });
      const skyHere = mix(st.sky.top, st.sky.horizon, st.moon.y);
      const offset = moonR * 2 * st.moon.fraction;
      const dir = st.moon.phase < 0.5 ? -1 : 1;
      if (st.moon.fraction < 0.98) {
        this.moonShadow.circle(mx + dir * offset, my, moonR * 1.02).fill({ color: skyHere });
      }
    }

    // Hills.
    this.drawHill(this.hillFar, this.hillSpecs.far, st.hills.far);
    this.drawHill(this.hillMid, this.hillSpecs.mid, st.hills.mid);
    this.drawHill(this.hillNear, this.hillSpecs.near, st.hills.near);

    // Ground and a lighter path band.
    this.ground.clear();
    this.ground.rect(0, skyH, w, h - skyH).fill({ color: st.ground });
    const pathY = skyH + (h - skyH) * 0.42;
    const pathH = (h - skyH) * 0.1;
    this.ground
      .moveTo(0, pathY + pathH * 0.3)
      .quadraticCurveTo(w * 0.5, pathY - pathH * 0.35, w, pathY + pathH * 0.15)
      .lineTo(w, pathY + pathH * 1.15)
      .quadraticCurveTo(w * 0.5, pathY + pathH * 0.7, 0, pathY + pathH * 1.3)
      .closePath()
      .fill({ color: st.path });
  }

  private drawHill(g: Graphics, spec: HillSpec, color: number): void {
    const { w, h } = this;
    g.clear();
    const step = 6;
    const pts: number[] = [0, h];
    for (let x = 0; x <= w + step; x += step) {
      const u = x / w;
      let y = h * spec.base;
      for (let i = 0; i < spec.amps.length; i++) {
        y += h * spec.amps[i] * Math.sin(u * spec.freqs[i] * Math.PI + spec.phases[i]);
      }
      pts.push(x, y);
    }
    pts.push(w + step, h);
    g.poly(pts).fill({ color });
  }
}

/** Small deterministic PRNG so star fields look the same on every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
