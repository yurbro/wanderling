import { Container, FillGradient, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import { hexToCss } from '../core/color';
import { WEATHER_TONES } from '../core/palette';
import type { RenderState, WeatherLayers } from '../core/types';

/**
 * Weather drawing, kept apart from the landscape so renderer.ts stays readable.
 *
 * Four pieces, each a display object the renderer slots into its layer order:
 *   clouds  a handful of flat paper cut-out clouds drifting with the wind
 *           (each baked to a texture once so fading them keeps them solid)
 *   fog     soft bands between the hill layers
 *   precip  rain streaks or snow flakes, one Graphics redrawn per frame
 *   flash   a full-screen sheet that lights up for lightning
 *
 * Particle counts are capped for battery: at most 150 drops or 110 flakes.
 */

const MAX_CLOUDS = 10;
const MAX_DROPS = 200;
const MAX_FLAKES = 110;

interface Cloud {
  sprite: Sprite;
  /** Position as fractions of the sky rectangle. */
  x: number;
  y: number;
  /** Width in pixels after drawing, for wrap-around. */
  width: number;
  /** 0 = far and small, 1 = near and large. */
  depth: number;
  /** Order in which clouds appear as cover grows. */
  rank: number;
  alpha: number;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  /** Snow only: sideways sway phase. */
  phase: number;
  r: number;
}

export class WeatherPainter {
  readonly clouds = new Container();
  readonly fogFar = new Graphics();
  readonly fogMid = new Graphics();
  readonly fogNear = new Graphics();
  readonly precip = new Graphics();
  readonly flash = new Graphics();

  private cloudList: Cloud[] = [];
  private cloudTextures: Texture[] = [];
  /** Painted clouds from the terrain kit; while empty, clouds are drawn. */
  private paintedClouds: Texture[] = [];
  private drops: Drop[] = [];
  private flakes: Drop[] = [];
  private w = 1;
  private h = 1;
  private skyH = 1;
  private layers: WeatherLayers | null = null;
  private nextFlash = 0;
  private flashAlpha = 0;
  private rng = seeded(11);

  /** Called on every resize. Rebuilds the particle pools and cloud shapes. */
  layout(renderer: Renderer, w: number, h: number, skyH: number): void {
    this.w = w;
    this.h = h;
    this.skyH = skyH;
    this.rng = seeded(11);
    this.makeClouds(renderer);
    this.makeParticles();
    this.flash.clear().rect(0, 0, w, h).fill({ color: WEATHER_TONES.paper });
    this.flash.alpha = 0;
    if (this.layers) this.apply(this.layers);
  }

  /** Called whenever the RenderState changes. */
  setState(rs: RenderState): void {
    this.layers = rs.weather;
    this.apply(rs.weather);
  }

  /** Called every frame while the scene is visible. */
  frame(dt: number, elapsed: number): void {
    const L = this.layers;
    if (!L) return;
    this.moveClouds(dt, L);
    this.drawPrecip(dt, elapsed, L);
    this.lightning(dt, L);
  }

  /* ---------------------------------------------------------------- clouds */

  /** Use the kit's painted clouds from now on. */
  setCloudTextures(textures: Texture[], renderer: Renderer): void {
    this.paintedClouds = textures;
    this.makeClouds(renderer);
  }

  private makeClouds(renderer: Renderer): void {
    this.clouds.removeChildren();
    for (const t of this.cloudTextures) t.destroy(true);
    this.cloudTextures = [];
    this.cloudList = [];
    const rng = this.rng;
    const unit = Math.min(this.w, this.h);
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const depth = rng();
      let sprite: Sprite;
      if (this.paintedClouds.length > 0) {
        const tex = this.paintedClouds[Math.floor(rng() * this.paintedClouds.length)];
        sprite = new Sprite(tex);
        sprite.scale.set((unit * (0.16 + depth * 0.26)) / tex.width);
      } else {
        const g = new Graphics();
        const scale = unit * (0.045 + depth * 0.075);
        drawCloud(g, scale, rng);
        // Bake the shape: a sprite fades as one solid piece, a Graphics would
        // show every overlapping puff while translucent.
        const texture = renderer.generateTexture({ target: g, resolution, antialias: true });
        g.destroy();
        this.cloudTextures.push(texture);
        sprite = new Sprite(texture);
      }
      const cloud: Cloud = {
        sprite,
        x: rng(),
        // Spread through the upper half of the sky; near clouds a little lower.
        y: 0.04 + rng() * 0.36 + depth * 0.1,
        width: sprite.width,
        depth,
        rank: i,
        alpha: 0,
      };
      sprite.alpha = 0;
      this.clouds.addChild(sprite);
      this.cloudList.push(cloud);
    }
    // Shuffle ranks so the clouds that appear first are spread across the sky.
    const ranks = this.cloudList.map((_, i) => i).sort(() => rng() - 0.5);
    this.cloudList.forEach((c, i) => (c.rank = ranks[i]));
    this.placeClouds();
  }

  private placeClouds(): void {
    for (const c of this.cloudList) {
      c.sprite.position.set(c.x * (this.w + c.width) - c.width, c.y * this.skyH);
    }
  }

  private moveClouds(dt: number, L: WeatherLayers): void {
    // Clouds always drift a little, faster and in the wind's direction when it blows.
    const dir = L.wind === 0 ? -1 : Math.sign(L.wind);
    const speed = (0.004 + Math.abs(L.wind) * 0.02) * dir; // sky widths per second
    const shown = Math.round(L.cloud * MAX_CLOUDS);
    for (const c of this.cloudList) {
      c.x += speed * dt * (0.5 + c.depth * 0.8);
      if (c.x > 1) c.x -= 1;
      if (c.x < 0) c.x += 1;
      const target = c.rank < shown ? 1 : 0;
      // Ease towards the target so clouds fade in and out instead of popping.
      c.alpha += (target - c.alpha) * Math.min(1, dt * 1.5);
      c.sprite.alpha = c.alpha;
      c.sprite.visible = c.alpha > 0.01;
    }
    this.placeClouds();
  }

  /* ------------------------------------------------------------- particles */

  private makeParticles(): void {
    const rng = this.rng;
    this.drops = [];
    this.flakes = [];
    for (let i = 0; i < MAX_DROPS; i++) {
      this.drops.push({
        x: rng() * this.w,
        y: rng() * this.h,
        len: 9 + rng() * 10,
        speed: 520 + rng() * 300,
        phase: rng() * Math.PI * 2,
        r: 1,
      });
    }
    for (let i = 0; i < MAX_FLAKES; i++) {
      this.flakes.push({
        x: rng() * this.w,
        y: rng() * this.h,
        len: 0,
        speed: 32 + rng() * 40,
        phase: rng() * Math.PI * 2,
        r: 1.3 + rng() * 1.8,
      });
    }
  }

  private drawPrecip(dt: number, elapsed: number, L: WeatherLayers): void {
    const g = this.precip;
    const rainN = Math.round(L.rain * MAX_DROPS);
    const snowN = Math.round(L.snow * MAX_FLAKES);
    if (rainN === 0 && snowN === 0) {
      if (g.visible) {
        g.clear();
        g.visible = false;
      }
      return;
    }
    g.visible = true;
    g.clear();
    const { w, h } = this;
    const slant = L.wind * 0.45; // horizontal pixels per vertical pixel

    if (rainN > 0) {
      const speedK = 0.75 + L.rain * 0.5;
      for (let i = 0; i < rainN; i++) {
        const d = this.drops[i];
        const vy = d.speed * speedK;
        d.y += vy * dt;
        d.x += vy * slant * dt;
        if (d.y > h + d.len) {
          d.y = -d.len - this.rng() * 40;
          d.x = this.rng() * (w + 80) - 40;
        }
        if (d.x > w + 40) d.x -= w + 80;
        if (d.x < -40) d.x += w + 80;
        g.moveTo(d.x, d.y).lineTo(d.x + slant * d.len, d.y + d.len);
      }
      g.stroke({ color: L.dropColor, width: 1.1, alpha: 0.3 + L.rain * 0.2 });
    }

    if (snowN > 0) {
      for (let i = 0; i < snowN; i++) {
        const f = this.flakes[i];
        f.y += f.speed * (0.8 + L.snow * 0.4) * dt;
        f.x += (Math.sin(elapsed * 0.9 + f.phase) * 14 + L.wind * 40) * dt;
        if (f.y > h + 4) {
          f.y = -4 - this.rng() * 30;
          f.x = this.rng() * w;
        }
        if (f.x > w + 6) f.x -= w + 12;
        if (f.x < -6) f.x += w + 12;
        g.circle(f.x, f.y, f.r);
      }
      g.fill({ color: WEATHER_TONES.paper, alpha: 0.85 });
    }
  }

  /* ------------------------------------------------------------- lightning */

  private lightning(dt: number, L: WeatherLayers): void {
    if (L.lightning <= 0) {
      if (this.flash.alpha !== 0) this.flash.alpha = 0;
      this.nextFlash = 0;
      return;
    }
    if (this.nextFlash <= 0) this.nextFlash = 4 + this.rng() * 12;
    this.nextFlash -= dt;
    if (this.nextFlash <= 0) {
      this.flashAlpha = 0.35 + this.rng() * 0.25;
      this.nextFlash = 5 + this.rng() * 14;
    }
    // Quick decay: a flash lasts a few frames.
    this.flashAlpha *= Math.exp(-dt * 9);
    this.flash.alpha = this.flashAlpha < 0.01 ? 0 : this.flashAlpha;
  }

  /* ------------------------------------------------------------------- fog */

  private apply(L: WeatherLayers): void {
    for (const c of this.cloudList) c.sprite.tint = L.cloudColor;
    this.drawFog(this.fogFar, 0.44, 0.6, L.fog * 0.85, L.fogColor);
    this.drawFog(this.fogMid, 0.5, 0.64, L.fog * 0.65, L.fogColor);
    this.drawFog(this.fogNear, 0.56, 0.78, L.fog * 0.45, L.fogColor);
  }

  /**
   * A band that fades in from the top and out again at the bottom, so hills
   * poke through it the way they do on a misty morning.
   */
  private drawFog(g: Graphics, top: number, bottom: number, alpha: number, color: number): void {
    g.clear();
    if (alpha <= 0.005) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const y0 = top * this.h;
    const y1 = bottom * this.h;
    const css = hexToCss(color);
    const rgb = (a: number): string => {
      const n = parseInt(css.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
    };
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: rgb(0) },
        { offset: 0.35, color: rgb(alpha) },
        { offset: 0.7, color: rgb(alpha) },
        { offset: 1, color: rgb(0) },
      ],
      textureSpace: 'local',
    });
    g.rect(0, y0, this.w, y1 - y0).fill(gradient);
  }
}

/**
 * A flat cut-out cloud: a row of overlapping circles whose bottoms all sit on
 * one line, like a paper cloud glued to a page. Drawn in white so the renderer
 * can tint it. Returns the drawn width.
 */
export function drawCloud(g: Graphics, scale: number, rng: () => number): number {
  const puffs = 4 + Math.floor(rng() * 3);
  const radii: number[] = [];
  const xs: number[] = [];
  let x = 0;
  for (let i = 0; i < puffs; i++) {
    // Bigger in the middle, smaller at the ends.
    const mid = 1 - Math.abs(i - (puffs - 1) / 2) / ((puffs - 1) / 2 + 0.6);
    const r = scale * (0.4 + mid * 0.6 + rng() * 0.15);
    xs.push(x + r);
    radii.push(r);
    x += r * 1.25;
  }
  const width = x + radii[radii.length - 1] * 0.75;
  const bottom = scale * 2.2;
  for (let i = 0; i < puffs; i++) {
    g.circle(xs[i], bottom - radii[i], radii[i]);
  }
  // Fill the gaps between puffs along the base line.
  const minR = Math.min(...radii);
  g.rect(xs[0], bottom - minR * 1.1, xs[puffs - 1] - xs[0], minR * 1.1);
  g.fill({ color: 0xffffff });
  return width;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

