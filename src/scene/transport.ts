import { Container, FillGradient, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import { hexToRgb, mix } from '../core/color';
import { PROPS, WANDERER } from '../core/palette';
import type { LegMode, RenderState } from '../core/types';
import { drawCloud } from './weatherLayers';

/**
 * Aboard: the inside of a train carriage, the deck of a ship, the cabin of a
 * plane.
 *
 * Train: the viewer sits in the carriage too. The far wall carries one big
 * round-cornered window, the land runs past outside behind telegraph poles,
 * and the wanderer sits on a green bench under the window with the whole
 * body in view. Everything is behind the figure; nothing covers it.
 *
 * Ferry and coastal ship: an open deck. A plank floor, a low bulwark with a
 * wooden handrail behind the wanderer, and beyond the rail the water and the
 * fjord walls the renderer paints. A slatted bench to sit on.
 *
 * Plane: the land is gone, a sea of clouds drifts below and the wanderer
 * looks out of a porthole in the fuselage (unchanged from before).
 *
 * `behind` goes between the land and the wanderer, `front` above the
 * wanderer. The land outside never sways; the cabin and deck do, with him.
 */

interface Figure {
  x: number;
  feetY: number;
  /** The place marker's unit (the path's depth), kept for the plane. */
  height: number;
  /** Pixels per wanderer unit: the figure is drawn at this scale. */
  unit: number;
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

  /** Outside the window: stays put while the carriage sways. */
  private outside = new Container();
  /** The carriage or the deck: moves with the wanderer. */
  private cabin = new Container();
  private poles = new Graphics();
  private carriage = new Graphics();
  private deck = new Graphics();
  /** The lantern's light on the deck planks by night; untinted, so it stays warm. */
  private deckLight = new Graphics();
  private cloudSea = new Container();
  private cloudFloor = new Graphics();
  private fuselage = new Graphics();
  private cloudTops: CloudTop[] = [];
  private cloudTextures: Texture[] = [];
  private poleXs: number[] = [];
  private w = 1;
  private h = 1;
  private figure: Figure = { x: 0, feetY: 0, height: 100, unit: 80 };
  private mode: LegMode = 'walk';
  private rng = seeded(47);

  constructor() {
    this.outside.addChild(this.cloudFloor, this.cloudSea, this.poles);
    this.cabin.addChild(this.carriage, this.deck, this.deckLight);
    this.behind.addChild(this.outside, this.cabin);
    this.front.addChild(this.fuselage);
    this.setMode('walk');
  }

  /** Vertical sway to apply to the wanderer so they move with the vehicle. */
  sway = 0;

  /** Where the train window's sill sits, as a fraction of the height; the renderer keeps the HUD's note clear of it. */
  get sillY(): number {
    return this.figure.feetY - 0.42 * this.figure.unit;
  }

  layout(renderer: Renderer, w: number, h: number, figure: Figure): void {
    this.w = w;
    this.h = h;
    this.figure = figure;
    this.rng = seeded(47);
    this.drawCarriage();
    this.drawDeck();
    this.drawDeckLight();
    this.drawFuselage();
    this.makeCloudSea(renderer);
    this.poleXs = [w * 0.3, w * 1.1];
  }

  setState(rs: RenderState): void {
    this.setMode(rs.travel.mode);
    const tint = rs.wanderer.tint;
    this.carriage.tint = tint;
    // The deck is out of doors: it takes the land's night, and the lantern makes a pool of light on it.
    this.deck.tint = rs.land.tint;
    this.deckLight.alpha = rs.wanderer.lantern ? rs.wanderer.lanternGlow : 0;
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
      this.cabin.y = this.sway;
      this.movePoles(dt, groundSpeed);
    } else if (this.mode === 'ferry' || this.mode === 'ship') {
      // At sea: a long slow roll, the ship a little livelier than the ferry.
      const k = this.mode === 'ship' ? 1.3 : 1;
      this.sway = Math.sin(elapsed * 0.9 * k) * 2.2 * k + Math.sin(elapsed * 0.35) * 1.4;
      this.cabin.y = this.sway;
    } else if (this.mode === 'fly') {
      this.sway = Math.sin(elapsed * 1.7) * 2 + Math.sin(elapsed * 0.6) * 1.5;
      this.front.y = this.sway;
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
    const atSea = mode === 'ferry' || mode === 'ship';
    this.poles.visible = mode === 'ride';
    this.carriage.visible = mode === 'ride';
    this.deck.visible = atSea;
    this.deckLight.visible = atSea;
    this.cloudSea.visible = mode === 'fly';
    this.cloudFloor.visible = mode === 'fly';
    this.fuselage.visible = mode === 'fly';
    if (mode !== 'fly') this.front.y = 0;
    if (mode === 'walk') this.cabin.y = 0;
  }

  /* --------------------------------------------------------------- train */

  /**
   * The carriage, seen from inside: the far wall with its window cut out, the
   * frame around the glass, a wainscot and floor below, and the bench the
   * wanderer sits on. All in pale wood tones so the cream body and the red
   * scarf still carry the picture.
   */
  private drawCarriage(): void {
    const g = this.carriage;
    const { w, h } = this;
    const { x, feetY, unit: u } = this.figure;
    const ink = WANDERER.ink;
    const sill = this.sillY;
    const frame = Math.max(6, 0.09 * u);
    const r = 0.24 * u;
    // The window opening: the whole width on a phone, capped on a wide screen.
    const left = Math.max(w * 0.055, x - 2.4 * u);
    const right = Math.min(w * 0.945, x + 3.0 * u);
    // The HUD's clock and lines sit on the wall above the window.
    const top = h * 0.235 + frame;
    g.clear();

    // The wall, with the window cut out of it. The wainscot and the floor are drawn over it below.
    g.rect(0, 0, w, h).fill({ color: PROPS.cabinWall });
    g.roundRect(left, top, right - left, sill - top, r).cut();

    // The frame: a wooden surround with a pencil line along both edges.
    g.roundRect(left - frame, top - frame, right - left + 2 * frame, sill - top + 2 * frame, r + frame)
      .stroke({ color: PROPS.cabinFrame, width: frame, alignment: 0.5 });
    g.roundRect(left - frame * 1.5, top - frame * 1.5, right - left + 3 * frame, sill - top + 3 * frame, r + frame * 1.5)
      .stroke({ color: ink, width: 1.1, alpha: 0.45 });
    g.roundRect(left - frame * 0.5, top - frame * 0.5, right - left + frame, sill - top + frame, r + frame * 0.5)
      .stroke({ color: ink, width: 1, alpha: 0.35 });
    // The sill: a ledge along the bottom of the window, lit from above.
    g.rect(left - frame * 1.5, sill + frame * 0.5, right - left + 3 * frame, frame * 0.9).fill({ color: PROPS.cabinSill });
    g.moveTo(left - frame * 1.5, sill + frame * 1.4).lineTo(right + frame * 1.5, sill + frame * 1.4).stroke({ color: ink, width: 1, alpha: 0.4 });

    // The wainscot below the window and the floor below that.
    const rail = feetY + 0.2 * u;
    const floor = feetY + 0.5 * u;
    g.rect(0, rail, w, floor - rail).fill({ color: PROPS.cabinPanel });
    g.moveTo(0, rail).lineTo(w, rail).stroke({ color: ink, width: 1.1, alpha: 0.35 });
    // Panel seams, a hand's width apart.
    for (let px = 0.3 * u; px < w; px += 1.1 * u) {
      g.moveTo(px, rail + 0.04 * u).lineTo(px, floor - 0.04 * u).stroke({ color: ink, width: 1, alpha: 0.14 });
    }
    g.rect(0, floor, w, h - floor).fill({ color: PROPS.cabinFloor });
    g.moveTo(0, floor).lineTo(w, floor).stroke({ color: ink, width: 1.2, alpha: 0.45 });
    // Floorboards running along the carriage.
    for (let fy = floor + 0.22 * u; fy < h; fy += 0.3 * u) {
      g.moveTo(0, fy).lineTo(w, fy).stroke({ color: ink, width: 1, alpha: 0.12 });
    }

    // The bench: a green cushion on a wooden frame, its back on the side he leans on.
    const line = { color: ink, width: 1.2, alpha: 0.7, join: 'round' as const };
    const seatTop = feetY - 0.03 * u;
    const seatL = x - 0.78 * u;
    const seatR = x + 0.82 * u;
    // Legs first so the cushion sits over them.
    for (const lx of [seatL + 0.1 * u, seatR - 0.16 * u]) {
      g.rect(lx, seatTop + 0.12 * u, 0.07 * u, 0.4 * u).fill({ color: PROPS.wood }).stroke(line);
    }
    // The back: a rounded board with a wooden cap.
    g.roundRect(seatL, feetY - 0.74 * u, 0.24 * u, 0.74 * u, 0.06 * u).fill({ color: PROPS.train }).stroke(line);
    g.roundRect(seatL - 0.02 * u, feetY - 0.78 * u, 0.28 * u, 0.08 * u, 0.03 * u).fill({ color: PROPS.wood }).stroke(line);
    // The cushion, with a seam line along its front edge.
    g.roundRect(seatL, seatTop, seatR - seatL, 0.16 * u, 0.05 * u).fill({ color: PROPS.train }).stroke(line);
    g.moveTo(seatL + 0.08 * u, seatTop + 0.1 * u).lineTo(seatR - 0.08 * u, seatTop + 0.1 * u).stroke({ color: ink, width: 1, alpha: 0.25 });
    // A wooden rail under the cushion.
    g.rect(seatL + 0.04 * u, seatTop + 0.16 * u, seatR - seatL - 0.08 * u, 0.05 * u).fill({ color: PROPS.wood }).stroke(line);
  }

  private movePoles(dt: number, groundSpeed: number): void {
    const { w } = this;
    const { unit: u } = this.figure;
    const g = this.poles;
    g.clear();
    const top = this.h * 0.3;
    const bottom = this.sillY + 4;
    for (let i = 0; i < this.poleXs.length; i++) {
      this.poleXs[i] -= groundSpeed * 1.3 * dt;
      if (this.poleXs[i] < -12) this.poleXs[i] = w + 20 + this.rng() * w * 0.6;
      const px = this.poleXs[i];
      g.moveTo(px, top).lineTo(px, bottom);
      g.moveTo(px - 0.16 * u, top + 0.12 * u).lineTo(px + 0.16 * u, top + 0.12 * u);
    }
    g.stroke({ color: WANDERER.ink, width: 3, alpha: 0.5, cap: 'round' });
  }

  /* ---------------------------------------------------------------- ship */

  /**
   * The deck: planks under him, a low bulwark with posts and a wooden handrail
   * behind him, and a slatted bench by the rail. The water and the fjord
   * beyond are the renderer's.
   */
  private drawDeck(): void {
    const g = this.deck;
    const { w, h } = this;
    const { x, feetY, unit: u } = this.figure;
    const ink = WANDERER.ink;
    const line = { color: ink, width: 1.2, alpha: 0.7, join: 'round' as const };
    const edge = feetY - 0.3 * u; // where the deck meets the bulwark
    const bulwarkTop = feetY - 0.52 * u;
    const railY = feetY - 0.8 * u;
    g.clear();

    // The deck floor, planks running along the ship, wider apart as they come nearer.
    g.rect(0, edge, w, h - edge).fill({ color: PROPS.deck });
    let py = edge;
    let gap = 0.1 * u;
    let seam = 0.4 * u;
    while (py < h) {
      g.moveTo(0, py).lineTo(w, py).stroke({ color: ink, width: 1, alpha: py === edge ? 0.5 : 0.16 });
      // A short seam where two planks meet, somewhere along each row.
      const sx = (seam * 7.3) % w;
      g.moveTo(sx, py).lineTo(sx, Math.min(h, py + gap)).stroke({ color: ink, width: 1, alpha: 0.14 });
      py += gap;
      gap *= 1.22;
      seam += 0.9 * u;
    }

    // The bulwark: a painted strip with a wooden cap, then posts and the handrail.
    g.rect(0, bulwarkTop, w, edge - bulwarkTop).fill({ color: PROPS.bulwark });
    g.moveTo(0, bulwarkTop).lineTo(w, bulwarkTop).stroke({ color: ink, width: 1.2, alpha: 0.5 });
    g.rect(0, bulwarkTop - 0.05 * u, w, 0.06 * u).fill({ color: PROPS.wood }).stroke({ color: ink, width: 1, alpha: 0.4 });
    for (let px = ((x - 0.1 * u) % (1.15 * u)) - 1.15 * u; px < w + u; px += 1.15 * u) {
      g.rect(px - 0.03 * u, railY, 0.06 * u, bulwarkTop - 0.05 * u - railY).fill({ color: PROPS.wood }).stroke({ color: ink, width: 1, alpha: 0.5 });
    }
    const midRail = (railY + bulwarkTop) / 2;
    g.moveTo(0, midRail).lineTo(w, midRail).stroke({ color: ink, width: 1.6, alpha: 0.55 });
    g.roundRect(0, railY - 0.04 * u, w, 0.08 * u, 0.02 * u).fill({ color: PROPS.wood }).stroke({ color: ink, width: 1.1, alpha: 0.55 });

    // A slatted wooden bench, its back to the rail.
    const seatTop = feetY - 0.03 * u;
    const seatL = x - 0.78 * u;
    const seatR = x + 0.82 * u;
    for (const lx of [seatL + 0.1 * u, seatR - 0.16 * u]) {
      g.rect(lx, seatTop + 0.1 * u, 0.07 * u, 0.36 * u).fill({ color: PROPS.woodDark }).stroke(line);
    }
    // Back slats.
    for (let i = 0; i < 3; i++) {
      const by = feetY - 0.72 * u + i * 0.21 * u;
      g.roundRect(seatL, by, 0.22 * u, 0.14 * u, 0.03 * u).fill({ color: PROPS.wood }).stroke(line);
    }
    g.rect(seatL + 0.08 * u, feetY - 0.74 * u, 0.06 * u, 0.74 * u).fill({ color: PROPS.woodDark }).stroke({ color: ink, width: 1, alpha: 0.5 });
    // Seat slats.
    for (let i = 0; i < 2; i++) {
      g.roundRect(seatL, seatTop + i * 0.09 * u, seatR - seatL, 0.08 * u, 0.02 * u).fill({ color: PROPS.wood }).stroke(line);
    }
  }

  /** A warm pool on the planks under the lantern, soft to its edge. */
  private drawDeckLight(): void {
    const g = this.deckLight;
    const { x, feetY, unit: u } = this.figure;
    g.clear();
    const lx = x + 0.45 * u;
    const ly = feetY + 0.02 * u;
    const { r, g: gg, b } = hexToRgb(WANDERER.glow);
    const rgba = (a: number): string => `rgba(${Math.round(r)}, ${Math.round(gg)}, ${Math.round(b)}, ${a})`;
    const pool = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: rgba(0.26) },
        { offset: 0.35, color: rgba(0.14) },
        { offset: 0.7, color: rgba(0.05) },
        { offset: 1, color: rgba(0) },
      ],
      textureSpace: 'local',
    });
    g.ellipse(lx, ly, 2.0 * u, 0.95 * u).fill(pool);
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
