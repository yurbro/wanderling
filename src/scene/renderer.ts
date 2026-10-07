import { Application, Container, FillGradient, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { mix } from '../core/color';
import { CELESTIAL } from '../core/palette';
import type { RenderState } from '../core/types';
import { blendRenderState, easeInOut } from '../core/blend';
import { KM_PER_HOUR } from '../core/journey';
import { PROPS, WANDERER } from '../core/palette';
import { SeaPainter } from './seaLayer';
import { TransportPainter } from './transport';
import { Wanderer } from './wanderer';
import { WeatherPainter } from './weatherLayers';
import { EXTRA_HEIGHT, TERRAIN_EXTRAS, bandSetFor, loadBands, loadProps, type BandName, type BandSet, type TerrainProps } from './terrain';
import type { Terrain } from '../core/types';

/** Fraction of the screen height where the sky meets the land. */
const HORIZON = 0.62;
/**
 * The wanderling's figure unit as a fraction of the screen height. The body is
 * 0.85 of a unit tall, so this puts it at about 9% of the screen (design says
 * about 8%; Yu asked for a touch bigger in session 22).
 */
const WANDERLING_HEIGHT = 0.105;
/** A new sky or weather eases in over this many seconds instead of jumping. */
const BLEND_SECONDS = 2;
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
  kind: 'tuft' | 'stone' | 'flower' | 'extra';
  x: number;
  y: number;
  /** 0 = at the horizon, 1 = at the bottom edge. Closer things move faster. */
  depth: number;
  g: Container;
  /** Size at depth 0; the kit's pictures each need their own. */
  base: number;
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

/** A hill layer: the flat fill below the ridge, and the painted band once the kit is in. */
interface HillLayer {
  view: Container;
  fill: Graphics;
  band: TilingSprite | null;
}

/** Painted band heights as a fraction of the screen height, and where each band's bottom sits below its ridge base. */
const BAND_HEIGHT: Record<BandName, number> = { far: 0.1, mid: 0.13, near: 0.15, ground: 0.07 };
const BAND_DROP: Record<BandName, number> = { far: 0.05, mid: 0.075, near: 0.1, ground: 0 };
/** Some sheets are drawn big: the city's houses and cobbles need to come down to the scene's scale. */
const TERRAIN_BAND_SCALE: Partial<Record<Terrain, number>> = { city: 0.55 };

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
  /** Each hill layer: a flat fill below the ridge, and once the kit is in, a painted band on top. */
  private hills: Record<'far' | 'mid' | 'near', HillLayer> = {
    far: { view: new Container(), fill: new Graphics(), band: null },
    mid: { view: new Container(), fill: new Graphics(), band: null },
    near: { view: new Container(), fill: new Graphics(), band: null },
  };
  private ground = new Graphics();
  /** The painted grass edge along the horizon, once the kit is in. */
  private groundBand: TilingSprite | null = null;
  private groundScroll = 0;
  /** The path and its pencil lines, above the grass band. */
  private pathLayer = new Graphics();
  /** The terrain kit's shared props, once loaded: they replace the drawn ones. */
  private props: TerrainProps | null = null;
  /** The painted bands of the terrain being walked, once loaded, and which terrain they are. */
  private bands: BandSet | null = null;
  private bandsFor: Terrain | null = null;
  private wantBands: Terrain | null = null;
  private signpostSprite = new Sprite();
  private lampSprite = new Sprite();
  private cottageSprite = new Sprite();
  private detailLayer = new Container();
  private details: Detail[] = [];
  private wanderer = new Wanderer();
  /** The place marker: signpost, and in towns a lamp and a cottage. */
  private marker = new Container();
  private signpost = new Graphics();
  private lamp = new Graphics();
  private cottage = new Graphics();
  /** Lamp glow and window light, untinted so they stay warm at night. */
  private markerLights = new Graphics();
  /** The marker slides with the ground between state updates. */
  private signpostX = 0;
  private signpostHome = 0;
  private signpostAhead = false;
  private signpostNoticed = false;
  private sea = new SeaPainter();
  private transport = new TransportPainter();
  private weather = new WeatherPainter();
  /** Hill wave phase offsets, in fractions of the screen width. */
  private scroll = { far: 0, mid: 0, near: 0 };
  private state: RenderState | null = null;
  /** Easing: where the picture started from and where it is heading. */
  private blendFrom: RenderState | null = null;
  private blendTo: RenderState | null = null;
  private blendT = 1;
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
      this.sea.gulls,
      this.hills.far.view,
      this.weather.fogFar,
      this.hills.mid.view,
      this.sea.waves,
      this.sea.boats,
      this.weather.fogMid,
      this.hills.near.view,
      this.ground,
      this.pathLayer,
      this.detailLayer,
      this.marker,
      this.markerLights,
      this.transport.behind,
      this.wanderer.glow,
      this.wanderer.view,
      this.wanderer.firefly,
      this.weather.fogNear,
      this.weather.precip,
      this.transport.front,
      this.weather.flash,
    );
    // A long press on the wanderling makes it turn and wave.
    this.wanderer.view.eventMode = 'static';
    this.wanderer.view.cursor = 'pointer';
    let pressTimer: number | null = null;
    const cancel = (): void => {
      if (pressTimer !== null) window.clearTimeout(pressTimer);
      pressTimer = null;
    };
    let pressed = false;
    this.wanderer.view.on('pointerdown', () => {
      cancel();
      pressed = false;
      pressTimer = window.setTimeout(() => {
        pressed = true;
        this.wanderer.wave();
      }, 450);
    });
    // Let go before the long press fires: that was a tap.
    this.wanderer.view.on('pointerup', () => {
      const wasPending = pressTimer !== null && !pressed;
      cancel();
      if (wasPending) this.wanderer.tapped();
    });
    this.wanderer.view.on('pointerupoutside', cancel);
    this.wanderer.view.on('pointercancel', cancel);
    // The leaf has its own answer and keeps the tap to itself.
    this.wanderer.leaf.on('pointerdown', (e) => {
      e.stopPropagation();
      this.wanderer.leafTapped();
    });

    for (const layer of Object.values(this.hills)) layer.view.addChild(layer.fill);

    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    void loadProps()
      .then((props) => this.dressProps(props))
      .catch((err) => console.warn('[wanderling] terrain props not loaded', err));
    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
  }

  /** Ease towards a new state over a couple of seconds; the first one shows at once. */
  setState(state: RenderState): void {
    if (!this.state || this.app.ticker.started === false) {
      this.apply(state, true);
      return;
    }
    this.blendFrom = this.state;
    this.blendTo = state;
    this.blendT = 0;
    // The place marker follows the journey engine exactly, not the easing.
    this.placeSignpost(state);
  }

  private apply(state: RenderState, syncMarker = false): void {
    this.state = state;
    this.ensureBands(state.land.terrain);
    this.weather.setState(state);
    this.wanderer.setState(state);
    this.sea.setState(state);
    this.transport.setState(state);
    this.showLand(state.travel.mode !== 'fly');
    this.tintDetails(state);
    this.redraw(syncMarker);
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
    this.drawMarker();
    this.sea.layout(this.w, this.h);
    this.transport.layout(this.app.renderer, this.w, this.h, this.figure());
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
    if (this.blendTo && this.blendFrom) {
      this.blendT = Math.min(1, this.blendT + dt / BLEND_SECONDS);
      const next = blendRenderState(this.blendFrom, this.blendTo, easeInOut(this.blendT));
      if (this.blendT >= 1) {
        this.blendFrom = null;
        this.blendTo = null;
      }
      this.apply(next, false);
    }
    this.weather.frame(dt, this.elapsed);
    this.sea.frame(dt, this.elapsed);
    this.fadeBands(dt);
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

  private redraw(syncMarker = true): void {
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
    if (syncMarker) this.placeSignpost();

    // Ground: a flat fill, and with the kit a painted grass edge along the horizon.
    this.ground.clear();
    this.ground.rect(0, skyH, w, h - skyH).fill({ color: st.ground });
    if (this.groundBand && this.bands) {
      const tex = this.bands.ground;
      const bandH = h * 0.07 * (TERRAIN_BAND_SCALE[this.bandsFor ?? 'hills'] ?? 1);
      const k = bandH / tex.height;
      this.groundBand.tileScale.set(k);
      this.groundBand.width = w + 2;
      this.groundBand.height = bandH;
      this.groundBand.position.set(-1, skyH - bandH * 0.4);
      this.groundBand.tint = st.ground;
    }
    // A lighter path band, with pencil lines along its edges.
    const pathY = skyH + (h - skyH) * 0.42;
    const pathH = (h - skyH) * 0.1;
    const step = 8;
    const pl = this.pathLayer;
    pl.clear();
    pl.moveTo(0, pathY + pathH * 0.3)
      .quadraticCurveTo(w * 0.5, pathY - pathH * 0.35, w, pathY + pathH * 0.15)
      .lineTo(w, pathY + pathH * 1.15)
      .quadraticCurveTo(w * 0.5, pathY + pathH * 0.7, 0, pathY + pathH * 1.3)
      .closePath()
      .fill({ color: st.path });
    if (!this.groundBand) {
      const inkOnGround = mix(st.ground, WANDERER.ink, 0.5);
      sketchLine(pl, straight(0, skyH + 0.5, w, step), inkOnGround, 0.35, 3.1);
    }
    const inkOnPath = mix(st.path, WANDERER.ink, 0.5);
    sketchLine(pl, quad(0, pathY + pathH * 0.3, w * 0.5, pathY - pathH * 0.35, w, pathY + pathH * 0.15, 28), inkOnPath, 0.5, 1.3);
    sketchLine(pl, quad(0, pathY + pathH * 1.3, w * 0.5, pathY + pathH * 0.7, w, pathY + pathH * 1.15, 28), inkOnPath, 0.5, 4.7);
  }

  /** Advance the walk: the wanderer strides, the world slides past. */
  private walk(dt: number): void {
    const st = this.state;
    if (!st) return;
    // No stopping to look at the sky while a place is coming into view.
    this.wanderer.allowPause = !this.marker.visible && Math.abs(this.signpostX - this.signpostHome) > this.w * 2;
    // The signpost comes into view ahead: the wanderling peers at it, once per approach.
    const inSight = this.marker.visible && this.signpostAhead && this.signpostX < this.w * 1.05;
    if (inSight && !this.signpostNoticed) this.wanderer.noticeSignpost();
    this.signpostNoticed = inSight;
    this.wanderer.frame(dt);
    // Aboard a vehicle the wanderer sits and sways with it.
    const f = this.figure();
    this.wanderer.view.y = f.feetY + this.transport.sway;
    const pace = st.wanderer.pace;
    const riding = st.travel.mode === 'ride';
    const scrollPace = riding ? 5 : pace;
    const groundSpeed = GROUND_SPEED * scrollPace;
    this.transport.frame(dt, this.elapsed, groundSpeed);
    if (scrollPace <= 0 || this.wanderer.paused) return;
    // The next place's signpost slides in with the ground. When it reaches
    // the wanderer's side we have arrived: hold everything there until the
    // journey engine confirms the rest on its next update.
    if (this.marker.visible || this.signpostAhead) {
      let x = this.signpostX - groundSpeed * dt;
      if (this.signpostAhead && x <= this.signpostHome) {
        x = this.signpostHome;
        this.setMarkerX(x, true);
        return;
      }
      this.setMarkerX(x, x > -this.w * 0.6 && x < this.w * 1.6);
    }
    const perWidth = (groundSpeed / this.w) * dt;
    this.scroll.far += perWidth * 0.03;
    this.scroll.mid += perWidth * 0.08;
    this.scroll.near += perWidth * 0.18;
    this.drawHills();
    this.moveDetails(dt, groundSpeed);
    if (this.groundBand) {
      this.groundScroll += groundSpeed * dt * 0.62;
      this.groundBand.tilePosition.x = -this.groundScroll;
    }
  }

  /** Where the wanderer stands and how tall they are, shared with the vehicles. */
  private figure(): { x: number; feetY: number; height: number } {
    const { w, h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const pathY = skyH + ground * 0.42;
    const pathH = ground * 0.1;
    return { x: w * 0.42, feetY: pathY + pathH * 0.6, height: ground * 0.36 };
  }

  private placeWanderer(): void {
    const f = this.figure();
    this.wanderer.layout(f.x, f.feetY, this.h * WANDERLING_HEIGHT);
  }

  /** In the air there is no land to draw: hills, ground, sea, fog and markers all go. */
  private showLand(show: boolean): void {
    for (const layer of [
      this.hills.far.view,
      this.hills.mid.view,
      this.hills.near.view,
      this.ground,
      this.pathLayer,
      this.detailLayer,
      this.marker,
      this.markerLights,
      this.sea.waves,
      this.sea.boats,
      this.sea.gulls,
      this.weather.fogFar,
      this.weather.fogMid,
      this.weather.fogNear,
    ]) {
      layer.visible = show;
    }
    if (!show) this.markerLights.visible = false;
  }

  private makeDetails(): void {
    this.detailLayer.removeChildren();
    this.details = [];
    const rng = seeded(23);
    const count = Math.round(14 + this.w / 40);
    for (let i = 0; i < count; i++) {
      const r = rng();
      // Every eighth or so is something that belongs to the terrain, when it has such things.
      const kind: Detail['kind'] = r < 0.2 ? 'extra' : r < 0.65 ? 'tuft' : r < 0.86 ? 'stone' : 'flower';
      let g: Container;
      let base = 1;
      if (this.props) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        base = this.dressDetail(sprite, kind, rng);
        g = sprite;
      } else {
        const gr = new Graphics();
        drawDetail(gr, kind, rng);
        g = gr;
      }
      const d: Detail = { kind, x: rng() * (this.w + 60) - 30, y: 0, depth: 0, g, base };
      this.dropDetail(d, rng());
      this.detailLayer.addChild(g);
      this.details.push(d);
    }
    if (this.state) this.tintDetails(this.state);
  }

  /**
   * Give a painted detail its picture for the terrain being walked: a tuft,
   * stone or flower from the shared pool, or one of the terrain's own things
   * (hay bales on the plain, a lighthouse at the coast). Returns the base scale.
   */
  private dressDetail(sprite: Sprite, kind: Detail['kind'], rng: () => number): number {
    const props = this.props!;
    const ground = this.h - this.h * HORIZON;
    const terrain = this.state?.land.terrain ?? 'hills';
    if (kind === 'extra') {
      const names = TERRAIN_EXTRAS[terrain];
      if (names.length === 0) {
        // Nothing special here: a stone instead.
        return this.dressDetail(sprite, 'stone', rng);
      }
      const name = names[Math.floor(rng() * names.length)];
      sprite.texture = props.extras[name];
      return (ground * EXTRA_HEIGHT[name]) / sprite.texture.height;
    }
    const pool = kind === 'tuft' ? props.grass : kind === 'stone' ? props.stones : props.flowers;
    sprite.texture = pool[Math.floor(rng() * pool.length)];
    const height = ground * (kind === 'tuft' ? 0.055 : kind === 'stone' ? 0.03 : 0.05) * (0.8 + rng() * 0.4);
    return height / sprite.texture.height;
  }

  /** Pick a row for a detail on either side of the path and scale it by depth. */
  private dropDetail(d: Detail, r: number): void {
    const { h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const pathTop = skyH + ground * 0.42 - ground * 0.05;
    const pathBottom = skyH + ground * 0.42 + ground * 0.135;
    // About a third of the details sit beyond the path, the rest in front; the
    // terrain's own things (a lighthouse, a haystack) always stand beyond it.
    if (d.kind === 'extra') r *= 0.35;
    d.y = r < 0.35 ? skyH + ground * 0.08 + (r / 0.35) * (pathTop - skyH - ground * 0.08) : pathBottom + ((r - 0.35) / 0.65) * (h - 12 - pathBottom);
    d.depth = (d.y - skyH) / ground;
    d.g.scale.set(d.base * (0.7 + d.depth * 0.9));
    d.g.position.set(d.x, d.y);
  }

  private moveDetails(dt: number, groundSpeed: number): void {
    for (const d of this.details) {
      // Things at the path's depth move with the path; nearer ones a bit faster.
      d.x -= groundSpeed * dt * (0.62 + d.depth * 0.8);
      if (d.x < -40) {
        d.x = this.w + 20 + Math.random() * 60;
        // Coming round again: take the picture of the terrain being walked now.
        if (this.props && d.g instanceof Sprite) d.base = this.dressDetail(d.g, d.kind, Math.random);
        this.dropDetail(d, Math.random());
      }
      d.g.x = d.x;
    }
  }

  private tintDetails(st: RenderState): void {
    if (this.props) {
      // Painted props carry their own colours; they only take the night and the grey.
      for (const d of this.details) d.g.tint = st.wanderer.tint;
      return;
    }
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
    const { relief, sea, seaColor, seaNear } = st.land;
    // At the coast the far and mid layers lie down flat and turn to water,
    // the mid one a little lower so the water has some width to it.
    this.drawHill(this.hills.far, this.hillSpecs.far, mix(st.hills.far, seaColor, sea), this.scroll.far, relief * (1 - sea), 0, 'far');
    this.drawHill(this.hills.mid, this.hillSpecs.mid, mix(st.hills.mid, seaNear, sea), this.scroll.mid, relief * (1 - sea), sea * 0.022, 'mid');
    this.drawHill(this.hills.near, this.hillSpecs.near, st.hills.near, this.scroll.near, relief, 0, 'near');
  }

  private drawHill(layer: HillLayer, spec: HillSpec, color: number, offset: number, relief: number, sink: number, name: BandName): void {
    const { w, h } = this;
    const g = layer.fill;
    g.clear();
    if (layer.band && this.bands) {
      // The painted band: its ridge is the picture's own; the land below it is a flat fill.
      const tex = this.bands[name];
      // Mountains stand taller, plains flatter; but a painted band only stretches so far before it looks pulled.
      const bandH = h * BAND_HEIGHT[name] * Math.min(1.4, Math.max(0.12, relief)) * (TERRAIN_BAND_SCALE[this.bandsFor ?? 'hills'] ?? 1);
      const k = bandH / tex.height;
      const bottom = h * (spec.base + BAND_DROP[name] + sink);
      layer.band.tileScale.set(k);
      layer.band.width = w + 2;
      layer.band.height = bandH;
      layer.band.position.set(-1, bottom - bandH);
      // The scroll is in screen widths; the picture scrolls at the same pace in screen pixels.
      layer.band.tilePosition.x = -offset * w;
      layer.band.tint = color;
      g.rect(0, bottom - 1, w, h - bottom + 1).fill({ color });
      return;
    }
    const step = 8;
    const pts: number[] = [0, h];
    // Flatter land sits a little lower, so the layers still stack cleanly.
    const base = spec.base + (1 - Math.min(1, relief)) * 0.02 + sink;
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
    // A pencil line along the ridge, like an outline in a sketchbook: its
    // thickness wanders and it sits a hair off the fill, the way a hand draws.
    if (relief > 0.05) {
      sketchLine(g, pts.slice(2, pts.length - 2), mix(color, WANDERER.ink, 0.6), 0.7, spec.phases[0] + offset * 40);
    }
  }

  /** The shared props have loaded: painted clouds, ground details and place props. */
  private dressProps(props: TerrainProps): void {
    this.props = props;
    this.weather.setCloudTextures(props.clouds, this.app.renderer);
    this.makeDetails();
    this.drawMarker();
    this.redraw();
  }

  /** Fetch the bands for the terrain being walked, unless they are here or on their way. */
  private ensureBands(terrain: Terrain): void {
    const key = bandSetFor(terrain);
    if (key === this.bandsFor || key === this.wantBands) return;
    this.wantBands = key;
    void loadBands(key)
      .then((set) => {
        if (this.wantBands !== key) return;
        this.applyBands(set, key);
      })
      .catch((err) => console.warn('[wanderling] terrain bands not loaded', err));
  }

  /** Hang a terrain's bands on the layers (making the sprites the first time) and fade them in. */
  private applyBands(set: BandSet, terrain: Terrain): void {
    this.bands = set;
    this.bandsFor = terrain;
    for (const name of ['far', 'mid', 'near'] as const) {
      const layer = this.hills[name];
      if (!layer.band) {
        layer.band = new TilingSprite({ texture: set[name], width: 10, height: 10 });
        layer.view.addChild(layer.band);
      } else {
        layer.band.texture = set[name];
      }
      layer.band.alpha = 0;
    }
    if (!this.groundBand) {
      this.groundBand = new TilingSprite({ texture: set.ground, width: 10, height: 10 });
      // Just above the ground fill, below the path.
      this.app.stage.addChildAt(this.groundBand, this.app.stage.getChildIndex(this.ground) + 1);
    } else {
      this.groundBand.texture = set.ground;
    }
    this.groundBand.alpha = 0;
    this.redressDetails();
    this.redraw();
  }

  /** The land has changed: the roadside things take the new terrain's pictures where they stand. */
  private redressDetails(): void {
    if (!this.props) return;
    for (const d of this.details) {
      if (d.g instanceof Sprite) {
        d.base = this.dressDetail(d.g, d.kind, Math.random);
        d.g.scale.set(d.base * (0.7 + d.depth * 0.9));
      }
    }
  }

  /** New bands ease in over a second or so instead of popping. */
  private fadeBands(dt: number): void {
    const sprites = [this.hills.far.band, this.hills.mid.band, this.hills.near.band, this.groundBand];
    for (const b of sprites) {
      if (b && b.alpha < 1) b.alpha = Math.min(1, b.alpha + dt * 0.9);
    }
  }

  /**
   * The props that mark a place: a wooden signpost with arrow boards (no
   * words), and in towns a lamp post by the path and a cottage beyond it.
   */
  private drawMarker(): void {
    this.marker.removeChildren();
    const ground = this.h - this.h * HORIZON;
    const s = ground * 0.36; // same unit as the wanderer's height
    if (this.props) {
      // The painted props: each stands on its bottom edge.
      const fit = (sprite: Sprite, tex: Texture, height: number): void => {
        sprite.texture = tex;
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(height / tex.height);
      };
      fit(this.signpostSprite, this.props.signpost, s * 0.9);
      fit(this.lampSprite, this.props.lamp, s * 1.25);
      fit(this.cottageSprite, this.props.cottage, s * 0.78);
      this.signpostSprite.position.set(0, 0);
      this.lampSprite.position.set(s * 0.42, 0);
      this.cottageSprite.position.set(-s * 0.55, -ground * 0.17);
      this.marker.addChild(this.cottageSprite, this.lampSprite, this.signpostSprite);
      this.placeSignpost();
      return;
    }
    this.marker.addChild(this.cottage, this.lamp, this.signpost);
    const ink = 0x4a4a52;
    const line = { color: ink, width: s * 0.012, join: 'round' as const };

    // Lamp post, a little ahead of the signpost on the path's edge.
    const l = this.lamp;
    l.clear();
    l.position.set(s * 0.42, 0);
    l.roundRect(-s * 0.02, -s * 1.0, s * 0.04, s * 1.0, s * 0.01).fill({ color: ink });
    l.rect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.03).fill({ color: ink });
    l.roundRect(-s * 0.07, -s * 1.1, s * 0.14, s * 0.11, s * 0.02).fill({ color: WANDERER.lanternGlass, alpha: 0.4 }).stroke(line);
    l.moveTo(-s * 0.09, -s * 1.1).lineTo(0, -s * 1.17).lineTo(s * 0.09, -s * 1.1).closePath().fill({ color: ink });

    // Cottage beyond the path, smaller for the distance.
    const c = this.cottage;
    c.clear();
    c.position.set(-s * 0.55, -ground * 0.17);
    c.scale.set(0.8);
    c.rect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5).fill({ color: PROPS.wall }).stroke(line);
    c.moveTo(-s * 0.47, -s * 0.5).lineTo(0, -s * 0.85).lineTo(s * 0.47, -s * 0.5).closePath().fill({ color: PROPS.roof }).stroke(line);
    c.rect(s * 0.15, -s * 0.78, s * 0.08, s * 0.16).fill({ color: PROPS.wood }).stroke(line);
    c.roundRect(-s * 0.3, -s * 0.3, s * 0.14, s * 0.3, s * 0.03).fill({ color: PROPS.wood }).stroke(line);
    c.rect(s * 0.06, -s * 0.36, s * 0.16, s * 0.16).fill({ color: PROPS.window }).stroke(line);

    const g = this.signpost;
    g.clear();
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

  /** Lamp glow and the cottage window, warm and untinted, by night. */
  private drawMarkerLights(glow: number, cottage: boolean): void {
    const g = this.markerLights;
    g.clear();
    if (glow <= 0.01 || !cottage) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const ground = this.h - this.h * HORIZON;
    const s = ground * 0.36;
    if (this.props) {
      // The painted lamp's glass sits near its top; the cottage's window is on its right half.
      const lampH = s * 1.25;
      const lx = s * 0.42;
      const ly = -lampH * 0.84;
      for (const [r, a] of [
        [0.55, 0.035],
        [0.38, 0.05],
        [0.22, 0.07],
      ] as const) {
        g.circle(lx, ly, r * s).fill({ color: WANDERER.glow, alpha: a * glow });
      }
      g.roundRect(lx - s * 0.05, ly - s * 0.05, s * 0.1, s * 0.1, s * 0.02).fill({ color: WANDERER.glow, alpha: 0.7 * glow });
      const cw = this.cottageSprite.width;
      const ch = this.cottageSprite.height;
      const cx = -s * 0.55 - cw / 2;
      const cy = -ground * 0.17 - ch;
      g.rect(cx + cw * 0.63, cy + ch * 0.64, cw * 0.13, ch * 0.19).fill({ color: WANDERER.glow, alpha: 0.75 * glow });
      g.circle(cx + cw * 0.695, cy + ch * 0.735, s * 0.3).fill({ color: WANDERER.glow, alpha: 0.05 * glow });
      return;
    }
    const lx = s * 0.42;
    const ly = -s * 1.045;
    for (const [r, a] of [
      [0.55, 0.035],
      [0.38, 0.05],
      [0.22, 0.07],
    ] as const) {
      g.circle(lx, ly, r * s).fill({ color: WANDERER.glow, alpha: a * glow });
    }
    g.roundRect(lx - s * 0.055, ly - s * 0.045, s * 0.11, s * 0.09, s * 0.015).fill({ color: WANDERER.glow, alpha: 0.85 * glow });
    // The window: the cottage is at (-0.55 s, -0.17 ground) and scaled 0.8.
    const wx = -s * 0.55 + s * 0.06 * 0.8;
    const wy = -ground * 0.17 - s * 0.36 * 0.8;
    g.rect(wx, wy, s * 0.16 * 0.8, s * 0.16 * 0.8).fill({ color: WANDERER.glow, alpha: 0.9 * glow });
    g.circle(wx + s * 0.064, wy + s * 0.064, s * 0.3).fill({ color: WANDERER.glow, alpha: 0.05 * glow });
  }

  private setMarkerX(x: number, visible: boolean): void {
    this.signpostX = x;
    this.marker.x = x;
    this.markerLights.x = x;
    this.marker.visible = visible;
    this.markerLights.visible = visible && this.markerLights.alpha > 0;
  }

  /** Sync the place marker from the journey engine's exact offset. */
  private placeSignpost(state: RenderState | null = this.state): void {
    const st = state;
    if (!st || st.marker === null) {
      this.marker.visible = false;
      this.markerLights.visible = false;
      this.signpostAhead = false;
      return;
    }
    const { w, h } = this;
    const skyH = h * HORIZON;
    const ground = h - skyH;
    const feetY = skyH + ground * 0.42 + ground * 0.1 * 0.6;
    // Just ahead of the wanderer when at the place.
    this.signpostHome = w * 0.42 + ground * 0.36 * 0.55;
    this.signpostAhead = st.marker.offsetKm > 0;
    const x = this.signpostHome + st.marker.offsetKm * PX_PER_KM;
    this.marker.y = feetY + ground * 0.015;
    this.markerLights.y = this.marker.y;
    this.marker.tint = st.wanderer.tint;
    this.lamp.visible = st.marker.cottage;
    this.cottage.visible = st.marker.cottage;
    this.lampSprite.visible = st.marker.cottage;
    this.cottageSprite.visible = st.marker.cottage;
    this.drawMarkerLights(st.wanderer.lantern ? st.wanderer.lanternGlow : 0, st.marker.cottage);
    this.markerLights.alpha = this.markerLights.visible ? 1 : 0;
    this.setMarkerX(x, x > -w * 0.6 && x < w * 1.6);
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

/* --------------------------------------------------------- sketch lines */

/**
 * Draw a polyline as a pencil stroke: a thin filled ribbon whose width
 * wanders between about one and two pixels and which wobbles a hair, so the
 * line reads as drawn by hand and matches the wanderling's cut-out outlines.
 * `pts` is [x0, y0, x1, y1, ...]; `phase` varies the wobble per line.
 */
function sketchLine(g: Graphics, pts: number[], color: number, alpha: number, phase: number): void {
  const n = pts.length / 2;
  if (n < 2) return;
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    const u = i * 0.37 + phase;
    const wobble = Math.sin(u * 1.9) * 0.6 + Math.sin(u * 4.3 + 1.1) * 0.35;
    const half = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u * 0.8 + 0.7)) + 0.2 * Math.sin(u * 2.7);
    top.push(x, y + wobble - half);
    bottom.unshift(x, y + wobble + half);
  }
  g.poly([...top, ...bottom]).fill({ color, alpha });
}

/** Points along a horizontal line. */
function straight(x0: number, y: number, x1: number, step: number): number[] {
  const out: number[] = [];
  for (let x = x0; x <= x1 + step; x += step) out.push(x, y);
  return out;
}

/** Points along a quadratic curve from (x0,y0) via control (cx,cy) to (x1,y1). */
function quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    out.push(a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1);
  }
  return out;
}
