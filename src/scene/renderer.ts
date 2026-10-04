import { Application, Container, FillGradient, Graphics } from 'pixi.js';
import { mix } from '../core/color';
import { CELESTIAL } from '../core/palette';
import type { RenderState } from '../core/types';
import { KM_PER_HOUR } from '../core/journey';
import { Wanderer } from './wanderer';
import { WeatherPainter } from './weatherLayers';

/** Fraction of the screen height where the sky meets the land. */
const HORIZON = 0.62;
/** How fast the ground slides past while the wanderer walks, in px/s. */
const GROUND_SPEED = 36;
/** The same walk measured in journey km, so signposts line up with the ground. */
const PX_PER_KM = GROUND_SPEED / (KM_PER_HOUR / 3600);

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  g: Graphics;
}

/** A tuft of grass, a stone or a small flower that scrolls past on the ground. */
interface Detail {
  kind: 'tuft' | 'stone' | 'flower';
  x: number;
  y: number;
  /** 0 = at the horizon, 1 = at the bottom edge. Closer things move faster. */
  depth: number;
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
 * Layer order, back to front: sky, stars, sun, moon, clouds, far hills, fog,
 * mid hills, fog, near hills, ground + path, ground details, the wanderer,
 * fog, rain or snow, lightning.
 *
 * The wanderer walks on the spot; the world slides past instead. Hills shift
 * their wave phase at three speeds and the ground details scroll with depth.
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
  private detailLayer = new Container();
  private details: Detail[] = [];
  private wanderer = new Wanderer();
  private signpost = new Graphics();
  /** The signpost slides with the ground between state updates. */
  private signpostX = 0;
  private signpostHome = 0;
  private signpostAhead = false;
  private weather = new WeatherPainter();
  /** Hill wave phase offsets, in fractions of the screen width. */
  private scroll = { far: 0, mid: 0, near: 0 };
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
      this.weather.clouds,
      this.hillFar,
      this.weather.fogFar,
      this.hillMid,
      this.weather.fogMid,
      this.hillNear,
      this.ground,
      this.detailLayer,
      this.signpost,
      this.wanderer.glow,
      this.wanderer.view,
      this.weather.fogNear,
      this.weather.precip,
      this.weather.flash,
    );

    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
  }

  setState(state: RenderState): void {
    this.state = state;
    this.weather.setState(state);
    this.wanderer.setState(state);
    this.tintDetails(state);
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
    this.makeDetails();
    this.placeWanderer();
    this.drawSignpost();
    this.weather.layout(this.app.renderer, this.w, this.h, this.h * HORIZON);
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
    // Clamp the step so a tab that was asleep does not fling particles around.
    const dt = Math.min(0.1, deltaMS / 1000);
    this.elapsed += dt;
    this.weather.frame(dt, this.elapsed);
    this.walk(dt);
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
    this.sunDisc.alpha = st.sun.alpha;
    this.sunHalo.alpha = st.sun.alpha;
    if (st.sun.visible && st.sun.alpha > 0.01) {
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
    const moonVisible = st.moon.visible && st.moon.alpha > 0.02;
    if (moonVisible) {
      const mx = st.moon.x * w;
      const my = st.moon.y * skyH;
      this.moonDisc.circle(mx, my, moonR).fill({ color: CELESTIAL.moon, alpha: st.moon.alpha });
      const skyHere = mix(st.sky.top, st.sky.horizon, st.moon.y);
      const offset = moonR * 2 * st.moon.fraction;
      const dir = st.moon.phase < 0.5 ? -1 : 1;
      if (st.moon.fraction < 0.98) {
        this.moonShadow.circle(mx + dir * offset, my, moonR * 1.02).fill({ color: skyHere });
      }
    }

    this.drawHills();
    this.placeSignpost();

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

  /** Advance the walk: the wanderer strides, the world slides past. */
  private walk(dt: number): void {
    const st = this.state;
    if (!st) return;
    this.wanderer.frame(dt);
    const pace = st.wanderer.pace;
    if (pace <= 0) return;
    // Ground speed in pixels per second; the hills lag behind by depth.
    const groundSpeed = GROUND_SPEED * pace;
    // The next place's signpost slides in with the ground. When it reaches
    // the wanderer's side we have arrived: hold everything there until the
    // journey engine confirms the rest on its next update.
    if (this.signpost.visible || this.signpostAhead) {
      let x = this.signpostX - groundSpeed * dt;
      if (this.signpostAhead && x <= this.signpostHome) {
        x = this.signpostHome;
        this.signpostX = x;
        this.signpost.x = x;
        this.signpost.visible = true;
        return;
      }
      this.signpostX = x;
      this.signpost.x = x;
      this.signpost.visible = x > -this.w * 0.5 && x < this.w * 1.5;
    }
    const perWidth = (groundSpeed / this.w) * dt;
    this.scroll.far += perWidth * 0.03;
    this.scroll.mid += perWidth * 0.08;
    this.scroll.near += perWidth * 0.18;
    this.drawHills();
    this.moveDetails(dt, groundSpeed);
  }

  private placeWanderer(): void {
    const { w, h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const pathY = skyH + ground * 0.42;
    const pathH = ground * 0.1;
    this.wanderer.layout(w * 0.42, pathY + pathH * 0.6, ground * 0.36);
  }

  private makeDetails(): void {
    this.detailLayer.removeChildren();
    this.details = [];
    const rng = seeded(23);
    const count = Math.round(14 + this.w / 40);
    for (let i = 0; i < count; i++) {
      const r = rng();
      const kind: Detail['kind'] = r < 0.6 ? 'tuft' : r < 0.85 ? 'stone' : 'flower';
      const g = new Graphics();
      drawDetail(g, kind, rng);
      const d: Detail = { kind, x: rng() * (this.w + 60) - 30, y: 0, depth: 0, g };
      this.dropDetail(d, rng());
      this.detailLayer.addChild(g);
      this.details.push(d);
    }
    if (this.state) this.tintDetails(this.state);
  }

  /** Pick a row for a detail on either side of the path and scale it by depth. */
  private dropDetail(d: Detail, r: number): void {
    const { h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const pathTop = skyH + ground * 0.42 - ground * 0.05;
    const pathBottom = skyH + ground * 0.42 + ground * 0.135;
    // About a third of the details sit beyond the path, the rest in front.
    d.y = r < 0.35 ? skyH + ground * 0.08 + (r / 0.35) * (pathTop - skyH - ground * 0.08) : pathBottom + ((r - 0.35) / 0.65) * (h - 12 - pathBottom);
    d.depth = (d.y - skyH) / ground;
    d.g.scale.set(0.7 + d.depth * 0.9);
    d.g.position.set(d.x, d.y);
  }

  private moveDetails(dt: number, groundSpeed: number): void {
    for (const d of this.details) {
      // Things at the path's depth move with the path; nearer ones a bit faster.
      d.x -= groundSpeed * dt * (0.62 + d.depth * 0.8);
      if (d.x < -40) {
        d.x = this.w + 20 + Math.random() * 60;
        this.dropDetail(d, Math.random());
      }
      d.g.x = d.x;
    }
  }

  private tintDetails(st: RenderState): void {
    const tuft = mix(st.ground, st.hills.near, 0.55);
    const stone = mix(st.ground, st.path, 0.7);
    const flower = mix(st.path, 0xf4efe4, 0.5);
    for (const d of this.details) {
      d.g.tint = d.kind === 'tuft' ? tuft : d.kind === 'stone' ? stone : flower;
    }
  }

  private drawHills(): void {
    const st = this.state;
    if (!st) return;
    const { relief, sea, seaColor } = st.land;
    // At the coast the far layer lies down flat and turns to water.
    this.drawHill(this.hillFar, this.hillSpecs.far, mix(st.hills.far, seaColor, sea), this.scroll.far, relief * (1 - sea));
    this.drawHill(this.hillMid, this.hillSpecs.mid, st.hills.mid, this.scroll.mid, relief * (1 - 0.5 * sea));
    this.drawHill(this.hillNear, this.hillSpecs.near, st.hills.near, this.scroll.near, relief);
  }

  private drawHill(g: Graphics, spec: HillSpec, color: number, offset: number, relief: number): void {
    const { w, h } = this;
    g.clear();
    const step = 8;
    const pts: number[] = [0, h];
    // Flatter land sits a little lower, so the layers still stack cleanly.
    const base = spec.base + (1 - Math.min(1, relief)) * 0.02;
    for (let x = 0; x <= w + step; x += step) {
      const u = x / w + offset;
      let y = h * base;
      for (let i = 0; i < spec.amps.length; i++) {
        y += h * spec.amps[i] * relief * Math.sin(u * spec.freqs[i] * Math.PI + spec.phases[i]);
      }
      pts.push(x, y);
    }
    pts.push(w + step, h);
    g.poly(pts).fill({ color });
  }

  /** A wooden signpost with an arrow board, no words: it marks a place. */
  private drawSignpost(): void {
    const g = this.signpost;
    g.clear();
    const ground = this.h - this.h * HORIZON;
    const s = ground * 0.36; // same unit as the wanderer's height
    const ink = 0x4a4a52;
    const line = { color: ink, width: s * 0.012, join: 'round' as const };
    g.roundRect(-s * 0.03, -s * 0.78, s * 0.06, s * 0.8, s * 0.015).fill({ color: 0x8c7355 }).stroke(line);
    g.moveTo(-s * 0.2, -s * 0.72)
      .lineTo(s * 0.14, -s * 0.72)
      .lineTo(s * 0.24, -s * 0.64)
      .lineTo(s * 0.14, -s * 0.56)
      .lineTo(-s * 0.2, -s * 0.56)
      .closePath()
      .fill({ color: 0xd9cfae })
      .stroke(line);
    g.moveTo(-s * 0.16, -s * 0.5)
      .lineTo(s * 0.1, -s * 0.5)
      .lineTo(s * 0.18, -s * 0.43)
      .lineTo(s * 0.1, -s * 0.36)
      .lineTo(-s * 0.16, -s * 0.36)
      .closePath()
      .fill({ color: 0xd9cfae })
      .stroke(line);
    this.placeSignpost();
  }

  /** Sync the signpost from the journey engine's exact offset. */
  private placeSignpost(): void {
    const st = this.state;
    if (!st || st.signpostKm === null) {
      this.signpost.visible = false;
      this.signpostAhead = false;
      return;
    }
    const { w, h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const feetY = skyH + ground * 0.42 + ground * 0.1 * 0.6;
    // Just ahead of the wanderer when at the place.
    this.signpostHome = w * 0.42 + ground * 0.36 * 0.55;
    this.signpostAhead = st.signpostKm > 0;
    this.signpostX = this.signpostHome + st.signpostKm * PX_PER_KM;
    this.signpost.visible = this.signpostX > -w * 0.5 && this.signpostX < w * 1.5;
    this.signpost.position.set(this.signpostX, feetY + ground * 0.015);
    this.signpost.tint = st.wanderer.tint;
  }
}

/** Draws one ground detail in white, about ten pixels tall; it is tinted later. */
function drawDetail(g: Graphics, kind: Detail['kind'], rng: () => number): void {
  const white = 0xffffff;
  if (kind === 'tuft') {
    const blades = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < blades; i++) {
      const t = (i / (blades - 1) - 0.5) * 2;
      const tipX = t * 4 + (rng() - 0.5);
      const tipY = -6 - rng() * 4 + Math.abs(t) * 2;
      // Each blade bends outwards a little, like grass rather than a fork.
      g.moveTo(0, 0).quadraticCurveTo(t * 0.8, tipY * 0.7, tipX, tipY);
    }
    g.stroke({ color: white, width: 1.4, cap: 'round' });
  } else if (kind === 'stone') {
    g.ellipse(0, -2, 3.5 + rng() * 1.5, 2.2).fill({ color: white });
  } else {
    g.moveTo(0, 0).quadraticCurveTo(1.2, -3, 0.6, -5).stroke({ color: white, width: 1 });
    g.circle(0.8, -6.2, 2.4).fill({ color: white });
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
