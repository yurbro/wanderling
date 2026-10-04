import { Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import { mix } from '../core/color';
import { PROPS, WANDERER } from '../core/palette';
import type { LegMode, RenderState } from '../core/types';
import { drawCloud } from './weatherLayers';

/**
 * The views from a train window and a plane window.
 *
 * Train: the usual landscape runs past fast behind telegraph poles; in front
 * of the wanderer stands the carriage wall and window frame, so they look
 * seated by the glass. Plane: the land is gone, a sea of clouds drifts below
 * and the wanderer looks out of a porthole in the fuselage.
 *
 * `behind` goes between the land and the wanderer, `front` above the wanderer.
 */

interface Figure {
  x: number;
  feetY: number;
  height: number;
}

interface CloudTop {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  width: number;
}

export class TransportPainter {
  readonly behind = new Container();
  readonly front = new Container();

  private poles = new Graphics();
  private carriage = new Graphics();
  private cloudSea = new Container();
  private cloudFloor = new Graphics();
  private fuselage = new Graphics();
  private cloudTops: CloudTop[] = [];
  private cloudTextures: Texture[] = [];
  private poleXs: number[] = [];
  private w = 1;
  private h = 1;
  private figure: Figure = { x: 0, feetY: 0, height: 100 };
  private mode: LegMode = 'walk';
  private rng = seeded(47);

  constructor() {
    this.behind.addChild(this.cloudFloor, this.cloudSea, this.poles);
    this.front.addChild(this.carriage, this.fuselage);
    this.setMode('walk');
  }

  /** Vertical sway to apply to the wanderer so they move with the vehicle. */
  sway = 0;

  layout(renderer: Renderer, w: number, h: number, figure: Figure): void {
    this.w = w;
    this.h = h;
    this.figure = figure;
    this.rng = seeded(47);
    this.drawCarriage();
    this.drawFuselage();
    this.makeCloudSea(renderer);
    this.poleXs = [w * 0.3, w * 1.1];
  }

  setState(rs: RenderState): void {
    this.setMode(rs.travel.mode);
    const tint = rs.wanderer.tint;
    this.carriage.tint = tint;
    this.fuselage.tint = tint;
    this.poles.tint = tint;
    // Cloud tops take the sky's cloud colour: paper by day, blue-grey by night.
    const cloud = rs.weather.cloudColor;
    for (const c of this.cloudTops) c.sprite.tint = cloud;
    this.cloudFloor.clear();
    this.cloudFloor.rect(0, this.h * 0.7, this.w, this.h * 0.3).fill({ color: mix(cloud, rs.sky.horizon, 0.25) });
  }

  frame(dt: number, elapsed: number, groundSpeed: number): void {
    if (this.mode === 'ride') {
      // Rails: a quick rattle and a slower roll.
      this.sway = Math.sin(elapsed * 9) * 1.1 + Math.sin(elapsed * 2.3) * 0.9;
      this.front.y = this.sway;
      this.behind.y = this.sway * 0.5;
      this.movePoles(dt, groundSpeed);
    } else if (this.mode === 'fly') {
      this.sway = Math.sin(elapsed * 1.7) * 2 + Math.sin(elapsed * 0.6) * 1.5;
      this.front.y = this.sway;
      this.behind.y = 0;
      for (const c of this.cloudTops) {
        c.x -= c.speed * dt;
        if (c.x < -c.width) c.x = this.w + this.rng() * this.w * 0.5;
        c.sprite.position.set(c.x, c.y);
      }
    } else {
      this.sway = 0;
    }
  }

  private setMode(mode: LegMode): void {
    this.mode = mode;
    this.poles.visible = mode === 'ride';
    this.carriage.visible = mode === 'ride';
    this.cloudSea.visible = mode === 'fly';
    this.cloudFloor.visible = mode === 'fly';
    this.fuselage.visible = mode === 'fly';
    if (mode === 'walk') {
      this.front.y = 0;
      this.behind.y = 0;
    }
  }

  /* --------------------------------------------------------------- train */

  private drawCarriage(): void {
    const g = this.carriage;
    const { w, h } = this;
    const { x, feetY, height: H } = this.figure;
    const sill = feetY - 0.45 * H;
    const ink = WANDERER.ink;
    g.clear();
    // The wall below the window, with a pale trim along the sill. The window
    // itself is the whole screen above it: the sky stays in view.
    g.rect(0, sill, w, h - sill).fill({ color: PROPS.train });
    g.rect(0, sill, w, 0.05 * H).fill({ color: PROPS.trim });
    g.moveTo(0, sill).lineTo(w, sill).stroke({ color: ink, width: 1.4, alpha: 0.7 });
    g.moveTo(0, sill + 0.05 * H).lineTo(w, sill + 0.05 * H).stroke({ color: ink, width: 1, alpha: 0.35 });
    // Thin posts between the panes, either side of the wanderer.
    for (const px of [x - 1.0 * H, x + 1.0 * H]) {
      g.rect(px - 0.03 * H, 0, 0.06 * H, sill).fill({ color: PROPS.train }).stroke({ color: ink, width: 1.2, alpha: 0.6 });
    }
  }

  private movePoles(dt: number, groundSpeed: number): void {
    const { w } = this;
    const { feetY, height: H } = this.figure;
    const g = this.poles;
    g.clear();
    const top = this.h * 0.34;
    const bottom = feetY - 0.45 * H;
    for (let i = 0; i < this.poleXs.length; i++) {
      this.poleXs[i] -= groundSpeed * 1.3 * dt;
      if (this.poleXs[i] < -12) this.poleXs[i] = w + 20 + this.rng() * w * 0.6;
      const px = this.poleXs[i];
      g.moveTo(px, top).lineTo(px, bottom);
      g.moveTo(px - 0.12 * H, top + 0.1 * H).lineTo(px + 0.12 * H, top + 0.1 * H);
    }
    g.stroke({ color: WANDERER.ink, width: 3, alpha: 0.55, cap: 'round' });
  }

  /* --------------------------------------------------------------- plane */

  private drawFuselage(): void {
    const g = this.fuselage;
    const { w, h } = this;
    const { x, feetY, height: H } = this.figure;
    const top = feetY - 1.38 * H;
    const ink = WANDERER.ink;
    g.clear();
    // The cabin wall with the porthole cut out of it.
    g.rect(0, top, w, h - top).fill({ color: PROPS.fuselage });
    const px = x - 0.52 * H;
    const py = feetY - 1.24 * H;
    const pw = 1.04 * H;
    const ph = 0.82 * H;
    g.roundRect(px, py, pw, ph, 0.3 * H).cut();
    // The frame around the glass, and a seam line along the cabin.
    g.roundRect(px - 0.04 * H, py - 0.04 * H, pw + 0.08 * H, ph + 0.08 * H, 0.33 * H).stroke({ color: PROPS.trim, width: 0.06 * H });
    g.roundRect(px, py, pw, ph, 0.3 * H).stroke({ color: ink, width: 1.2, alpha: 0.6 });
    g.moveTo(0, top + 0.08 * H).lineTo(w, top + 0.08 * H).stroke({ color: ink, width: 1, alpha: 0.3 });
    g.moveTo(0, feetY + 0.1 * H).lineTo(w, feetY + 0.1 * H).stroke({ color: ink, width: 1, alpha: 0.25 });
    // A row of rivets along the window line.
    for (let rx = 10; rx < w; rx += 36) {
      if (Math.abs(rx - x) < 0.75 * H) continue;
      g.circle(rx, py + ph / 2, 1.6).fill({ color: ink, alpha: 0.3 });
    }
  }

  private makeCloudSea(renderer: Renderer): void {
    this.cloudSea.removeChildren();
    for (const t of this.cloudTextures) t.destroy(true);
    this.cloudTextures = [];
    this.cloudTops = [];
    const rng = this.rng;
    const unit = Math.min(this.w, this.h);
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const rows: [number, number, number, number][] = [
      // y as a fraction of height, scale, speed px/s, count
      [0.6, 0.075, 5, 6],
      [0.66, 0.11, 9, 6],
      [0.73, 0.15, 14, 5],
    ];
    for (const [yf, scale, speed, count] of rows) {
      for (let i = 0; i < count; i++) {
        const g = new Graphics();
        drawCloud(g, unit * scale, rng);
        const texture = renderer.generateTexture({ target: g, resolution, antialias: true });
        g.destroy();
        this.cloudTextures.push(texture);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0, 1);
        const top: CloudTop = { sprite, x: (i / count) * this.w * 1.3 + rng() * 40 - 20, y: this.h * (yf + rng() * 0.03), speed, width: sprite.width };
        sprite.position.set(top.x, top.y);
        this.cloudSea.addChild(sprite);
        this.cloudTops.push(top);
      }
    }
  }
}


function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
