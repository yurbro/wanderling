import { Assets, Container, Graphics, MeshRope, Point, Sprite, Texture } from 'pixi.js';
import { WANDERER } from '../core/palette';
import type { LeafState, RenderState, WandererState } from '../core/types';

/**
 * The wanderling: a small egg-shaped creature with a leaf on its head, put
 * together like a paper doll from cut-out pictures of its parts (the parts
 * sheet in docs/design/art/, cut into public/art/). Eight moving parts: body,
 * leaf, eyes, scarf tail, backpack, two legs and two tiny hands; plus the
 * scarf band, a big leaf for the rain and a lantern for the night. The eyes
 * and the puff of breath are the only parts still drawn in code, so they can
 * blink, smile and squint.
 *
 * Proportions follow the turnaround sheet (see the README there): with the
 * body height as H, the eyes sit 0.3 H from the top, the scarf band is
 * centred at 0.45 H, the leaf stands about 0.65 H above the head, the hands
 * are small ovals on the lower half, the boots sit below the body and the
 * backpack shows behind it.
 *
 * The design lives in a unit space where the boots stand at y = 0 and the
 * body is BODY_H units tall, facing right. Everything is laid out at U
 * pixels per unit and the whole figure is then scaled to the height the
 * renderer asks for.
 *
 * The leaf is a weather vane: it sways with the real wind. In a strong wind
 * the body leans in, the leaf and scarf stream behind and the eyes squint.
 * When it rains the wanderling holds a big leaf up as an umbrella; after
 * sunset it carries a small lantern (its glow and flame live in a separate,
 * untinted layer behind the figure). Below freezing the scarf is wrapped
 * tight and a puff of breath shows now and then.
 *
 * Now and then the wanderling stops to look at the sky (the renderer holds
 * the world still while `paused`), or turns to look at whoever is watching:
 * both eyes, bent into a smile.
 */

/**
 * Little things the wanderling does on its own: a look up at the sky, a smile
 * at the viewer, a look left and right, a small hop, a shake of the rain off,
 * a stretch, a doze while sitting, and a wave when pressed.
 */
type Gesture =
  | 'none' | 'gaze' | 'glance' | 'lookaround' | 'hop' | 'shake' | 'stretch' | 'doze' | 'wave' | 'window' | 'peer' | 'kick'
  | 'tickle' | 'sulk' | 'candy' | 'boing';
/** Eyes: one dot in profile, two dots or a smile facing the viewer, a squint, or closed. */
type EyeMode = 'side' | 'front' | 'smile' | 'squint' | 'closed' | 'flat';
/** How long each gesture runs, in seconds. */
const GESTURE_SECONDS: Record<Exclude<Gesture, 'none'>, number> = {
  gaze: 4,
  glance: 2,
  lookaround: 2.6,
  hop: 0.65,
  shake: 0.8,
  stretch: 1.8,
  doze: 2.4,
  wave: 2.6,
  window: 3.2,
  peer: 2.2,
  kick: 1.2,
  tickle: 0.9,
  sulk: 2.2,
  candy: 2.6,
  boing: 0.9,
};
/** Gestures during which the walk stops. */
const STOPPING: ReadonlySet<Gesture> = new Set<Gesture>(['gaze', 'lookaround', 'stretch', 'wave', 'sulk', 'candy']);
/** How many points the leaf's stalk bends through. */
const LEAF_POINTS = 9;

const U = 100;
/** Body height in units; the boots take the rest below it. */
const BODY_H = 0.85;
const BOOT_H = 0.1;
/** Top and bottom of the body in unit space (y grows downwards). */
const BODY_TOP = -(BOOT_H + BODY_H);
const BODY_BOTTOM = -BOOT_H;
/** Half width of the body at its widest, a little below the middle. */
const BODY_HALF_W = (BODY_H * 0.9) / 2;
/** Where the trunk pivots: at the bottom of the body. */
const PIVOT = { x: 0, y: BODY_BOTTOM };
/** The hands hang from here on the sides of the body, and are this long. */
const SHOULDER = { x: BODY_HALF_W * 0.86, y: BODY_TOP + BODY_H * 0.56 };
const ARM_LEN = BODY_H * 0.2;
const STROKE = 0.013 * U;
/** The eye line, and the eyes' spots from the side, the front, and squinting. */
const EYE_Y = BODY_TOP + BODY_H * 0.3;
const EYE_SIDE = { x: BODY_HALF_W * 0.62, y: EYE_Y };
const EYE_FRONT = [
  { x: -BODY_HALF_W * 0.3, y: EYE_Y },
  { x: BODY_HALF_W * 0.3, y: EYE_Y },
];
const EYE_R = BODY_H * 0.03;
/** The scarf band is centred at 0.45 H; the tail is knotted at the back. */
const SCARF_Y = BODY_TOP + BODY_H * 0.45;
/** Lantern: anchored at the handle, the glass sits this far down its height. */
const LANTERN_H = BODY_H * 0.4;
const LANTERN_GLASS = 0.62;
/** How many points the scarf tail bends through. */
const TAIL_POINTS = 9;
/** How high a boot lifts off the ground mid-stride, in units. */
const STEP_LIFT = 0.07;
const STEP_SWING = 0.55;

/** y in trunk space (relative to the pivot) for a y in figure space. */
const ty = (y: number): number => (y - PIVOT.y) * U;

const PART_NAMES = ['body', 'leaf', 'scarf-band', 'scarf-tail', 'backpack', 'boot', 'hand', 'leaf-umbrella', 'lantern'] as const;
type PartName = (typeof PART_NAMES)[number];

/** The cut-out pictures, loaded once and shared by every figure. */
let partsPromise: Promise<Record<PartName, Texture>> | null = null;
export function loadParts(): Promise<Record<PartName, Texture>> {
  if (!partsPromise) {
    const base = import.meta.env.BASE_URL;
    partsPromise = Promise.all(PART_NAMES.map((n) => Assets.load<Texture>(`${base}art/${n}.png`))).then((textures) => {
      // Mipmaps: the pictures are drawn a little smaller than they are, and
      // without them the edges shimmer and step.
      for (const tex of textures) {
        tex.source.autoGenerateMipmaps = true;
        tex.source.scaleMode = 'linear';
        tex.source.update();
      }
      const out = {} as Record<PartName, Texture>;
      PART_NAMES.forEach((n, i) => (out[n] = textures[i]));
      return out;
    });
  }
  return partsPromise;
}

/** A sprite sized to `height` units keeping its picture's proportions. */
function fit(sprite: Sprite, height: number): void {
  const { width: w, height: h } = sprite.texture;
  sprite.height = height * U;
  sprite.width = (height * U * w) / h;
}

export class Wanderer {
  /** The figure; tinted by day and night. Add this above the ground. */
  readonly view = new Container();
  /** The lantern's halo and flame; add this just behind the figure, untinted. */
  readonly glow = new Graphics();

  /** Everything above the boots: rotates for the walking rock, the gaze and the lean. */
  private trunk = new Container();
  private backHand = new Sprite();
  private frontHand = new Sprite();
  private backLeg = new Sprite();
  private frontLeg = new Sprite();
  private body = new Sprite();
  private backpack = new Sprite();
  /** The leaf: a ribbon of points from the stalk's foot to the tip, so the stalk bends. Tap it. */
  readonly leaf = new Container();
  private leafRope: MeshRope | null = null;
  private leafPoints: Point[] = [];
  private leafTexture: Texture | null = null;
  private leafEnv: LeafState = { droop: 0, toSun: 0, stiff: 0, tint: 0xffffff };
  /** A sweet to offer after a sulk. */
  private candy = new Graphics();
  /** Recent taps, for telling one tap from a tickle from a pestering. */
  private taps: number[] = [];
  private eyes = new Graphics();
  private scarf = new Sprite();
  /** The scarf tail is a ribbon of points so it can really ripple. */
  private tail = new Container();
  private tailRope: MeshRope | null = null;
  private tailPoints: Point[] = [];
  private tailTexture: Texture | null = null;
  private leafUmbrella = new Sprite();
  private lantern = new Sprite();
  private breath = new Graphics();
  /** A soft patch of shade under the boots, so the figure stands on the ground rather than over it. */
  private shadow = new Graphics();
  /** A pebble to kick along the path now and then. */
  private pebble = new Graphics();
  /** The firefly that keeps watch while the wanderling sleeps; untinted, add above the figure. */
  readonly firefly = new Graphics();
  private asleep = false;
  private mode: 'walk' | 'ride' | 'fly' = 'walk';

  private state: WandererState | null = null;
  private wind = 0;
  private phase = 0;
  private time = 0;
  private feet = { x: 0, y: 0 };
  private scale = 1;
  private gesture: Gesture = 'none';
  private gestureLeft = 0;
  private gestureLength = 1;
  private nextGesture = 12;
  /** 0 standing, 1 sat down on the path (eased). */
  private sit = 0;
  /** Leaf drooping while dozing (eased). */
  private droop = 0;
  private shiverLeft = 0;
  private nextShiver = 5;
  private tilt = 0;
  private lean = 0;
  private perk = 0;
  private lastDt = 0.033;
  private eyeMode: EyeMode = 'side';
  private blinkLeft = 0;
  private nextBlink = 3;
  private breathLeft = 0;
  private nextBreath = 4;
  private cold = false;
  /** The sprites' scales as fitted by dress(), so pose() can scale relative to them. */
  private leafBase = { x: 1, y: 1 };
  private scarfBase = { x: 1, y: 1 };
  /** Parts with weight follow the body half a beat late and settle like springs. */
  private leafSpring = { a: 0, v: 0 };
  private packSpring = { a: 0, v: 0 };
  private frontHandSpring = { a: 0, v: 0 };
  private backHandSpring = { a: 0, v: 0 };
  private lanternSpring = { a: 0, v: 0 };
  private lanternLastX = 0;
  /** The renderer clears this while a signpost is near, so pauses never fight an arrival. */
  allowPause = true;

  constructor() {
    this.trunk.position.set(PIVOT.x * U, PIVOT.y * U);
    this.trunk.addChild(
      this.backHand,
      this.backpack,
      this.tail,
      this.body,
      this.leaf,
      this.scarf,
      this.eyes,
      this.frontHand,
      this.lantern,
      this.leafUmbrella,
    );
    this.view.addChild(this.shadow, this.pebble, this.backLeg, this.frontLeg, this.trunk, this.breath);
    this.trunk.addChild(this.candy);
    this.candy.visible = false;
    this.drawCandy();
    this.pebble.visible = false;
    this.firefly.visible = false;
    // Nothing shows until the pictures are in; the eyes wait with them.
    this.trunk.visible = false;
    this.backLeg.visible = false;
    this.frontLeg.visible = false;
    this.leafUmbrella.visible = false;
    this.lantern.visible = false;
    this.breath.visible = false;
    this.glow.visible = false;
    this.drawBreath();
    this.pebble.ellipse(0, 0, 0.035 * U, 0.025 * U).fill({ color: 0x9a9a8c }).stroke({ color: WANDERER.ink, width: STROKE * 0.8, alpha: 0.7 });
    this.shadow.ellipse(0.02 * U, 0.01 * U, BODY_HALF_W * 1.05 * U, 0.045 * U).fill({ color: WANDERER.ink, alpha: 0.14 });
    this.drawEyes('side');
    void loadParts().then((parts) => this.dress(parts)).catch((err) => console.warn('[wanderling] parts not loaded', err));
  }

  /** True while the wanderling has stopped walking for a gesture. */
  get paused(): boolean {
    return STOPPING.has(this.gesture);
  }

  /** Turn and wave at whoever is watching (a long press). */
  wave(): void {
    this.begin('wave');
  }

  /** A tap on the wanderling: one gets a smile or a hop, a few a tickle, five quick ones a sulk and then a sweet. */
  tapped(): void {
    if (this.asleep || this.gesture === 'sulk' || this.gesture === 'candy') return;
    const now = this.time;
    this.taps = this.taps.filter((t) => now - t < 1.6);
    this.taps.push(now);
    if (this.taps.length >= 5) {
      this.taps = [];
      this.begin('sulk');
    } else if (this.taps.length >= 2) {
      this.begin('tickle');
    } else {
      this.begin(Math.random() < 0.5 ? 'glance' : 'hop');
    }
  }

  /** A tap on the leaf: it boings, and the wanderling looks up at it. */
  leafTapped(): void {
    if (this.asleep) return;
    this.leafSpring.v += this.leafSpring.a > 0 ? -16 : 16;
    if (this.gesture === 'none' || this.gesture === 'boing') this.begin('boing');
  }

  /** The signpost has come into view ahead: peer at it (does not stop the walk). */
  noticeSignpost(): void {
    if (this.gesture === 'none' && this.state && this.state.pace > 0 && !this.asleep) this.begin('peer');
  }

  /** How far into the current gesture, 0 to 1. */
  private get progress(): number {
    return this.gesture === 'none' ? 0 : 1 - Math.max(0, this.gestureLeft) / this.gestureLength;
  }

  /** Start a gesture now (also used by the demo and screenshots). */
  begin(g: Exclude<Gesture, 'none'>): void {
    this.gesture = g;
    this.gestureLength = GESTURE_SECONDS[g];
    this.gestureLeft = this.gestureLength;
    // A shake throws the leaf about; a hop flicks it.
    if (g === 'shake') this.leafSpring.v += 9;
    if (g === 'hop') this.leafSpring.v -= 3;
    if (g === 'tickle') this.leafSpring.v += 7;
    this.chooseEyes();
  }

  /** Place the boots at (x, groundY) and scale the figure to `height` pixels per unit. */
  layout(x: number, groundY: number, height: number): void {
    this.feet = { x, y: groundY };
    this.scale = height / U;
    this.view.position.set(x, groundY);
    this.view.scale.set(this.scale);
    this.glow.scale.set(this.scale);
    this.pose();
  }

  setState(rs: RenderState): void {
    this.state = rs.wanderer;
    this.wind = rs.weather.wind;
    const w = rs.wanderer;
    this.leafUmbrella.visible = w.umbrella;
    this.lantern.visible = w.lantern;
    this.view.tint = w.tint;
    this.cold = w.cold;
    this.asleep = w.asleep;
    this.leafEnv = w.leaf;
    if (this.leafRope) this.leafRope.tint = w.leaf.tint;
    this.leafUmbrella.tint = w.leaf.tint;
    this.mode = rs.travel.mode;
    // Asleep, the lantern is put down (out of sight) and the firefly comes.
    this.lantern.visible = w.lantern && !w.asleep;
    this.drawGlow(w.lantern && !w.asleep ? w.lanternGlow : 0);
    this.chooseEyes();
    this.pose();
  }

  frame(dt: number): void {
    if (!this.state) return;
    this.time += dt;
    this.lastDt = dt;
    this.gestures(dt);
    this.blink(dt);
    this.breathe(dt);
    this.shiver(dt);
    this.fly(dt);
    // A dawdling 1.1 steps a second.
    const pace = this.paused ? 0 : this.state.pace;
    this.phase += dt * Math.PI * 2 * 1.1 * pace;
    this.pose();
  }

  /* ----------------------------------------------------------- dressing */

  /** Hang the pictures on the skeleton: anchors at the joints, sizes in body units. */
  private dress(parts: Record<PartName, Texture>): void {
    // Body: stands on the pivot, bottom centre.
    this.body.texture = parts.body;
    this.body.anchor.set(0.5, 1);
    this.body.position.set(0, ty(BODY_BOTTOM) + STROKE * 0.5);
    fit(this.body, BODY_H + 0.01);

    // Leaf: the picture is turned so the stalk's foot is at its left edge and
    // the tip at its right; a rope of points runs the length of it, so the
    // stalk bends instead of turning as one stiff piece.
    const leafTex = parts.leaf;
    this.leafTexture = leafTex;
    this.leafPoints = Array.from({ length: LEAF_POINTS }, () => new Point(0, 0));
    this.leafRope = new MeshRope({ texture: leafTex, points: this.leafPoints });
    this.leafRope.tint = this.leafEnv.tint;
    this.leaf.removeChildren();
    this.leaf.addChild(this.leafRope);
    this.leaf.position.set(-0.01 * U, ty(BODY_TOP) + STROKE * 1.2);
    const leafScale = (BODY_H * 0.64 * U) / leafTex.width;
    this.leaf.scale.set(leafScale);
    // Tappable: a generous box around the leaf.
    this.leaf.eventMode = 'static';
    this.leaf.cursor = 'pointer';
    // (The picture is padded so the stalk runs along the ribbon's centre line.)
    this.leaf.hitArea = { contains: (x: number, y: number) => Math.abs(x) < leafTex.width * 0.8 && y < leafTex.width * 0.1 && y > -leafTex.width * 1.15 };
    this.shapeLeaf(0, 0, 0);

    // Scarf band: centred on the body at 0.45 H, a touch wider than the body.
    this.scarf.texture = parts['scarf-band'];
    this.scarf.anchor.set(0.5, 0.5);
    this.scarf.position.set(0.01 * U, ty(SCARF_Y));
    // The band is stretched to the body's width and squashed to 0.13 H: the
    // picture is drawn flatter than the body's curve, so it does not keep its aspect.
    this.scarf.width = BODY_HALF_W * 2 * 1.08 * U;
    this.scarf.height = BODY_H * 0.14 * U;

    // Scarf tail: a rope of points from the knot at the back out to the tip, so
    // the picture bends along a wave instead of turning as one stiff piece.
    const tailTex = parts['scarf-tail'];
    this.tailTexture = tailTex;
    this.tailPoints = Array.from({ length: TAIL_POINTS }, () => new Point(0, 0));
    this.tailRope = new MeshRope({ texture: tailTex, points: this.tailPoints });
    this.tail.removeChildren();
    this.tail.addChild(this.tailRope);
    this.tail.position.set(-BODY_HALF_W * 0.93 * U, ty(SCARF_Y - 0.005));
    const tailScale = (BODY_H * 0.26 * U) / tailTex.height;
    this.tail.scale.set(tailScale);
    this.shapeTail(1, 0, 0);

    // Backpack: most of it behind the body, flap on top.
    this.backpack.texture = parts.backpack;
    this.backpack.anchor.set(0.5, 0.5);
    this.backpack.position.set(-BODY_HALF_W * 0.8 * U, ty(BODY_TOP + BODY_H * 0.5));
    fit(this.backpack, BODY_H * 0.72);

    // Boots: hang from the hip, toe forward.
    for (const [leg, dx] of [
      [this.backLeg, -BODY_HALF_W * 0.3],
      [this.frontLeg, BODY_HALF_W * 0.3],
    ] as const) {
      leg.texture = parts.boot;
      leg.anchor.set(0.42, 0.08);
      leg.position.set(dx * U, (BODY_BOTTOM - 0.03) * U);
      fit(leg, BOOT_H + 0.07);
    }
    this.backLeg.tint = 0xcfcfd4;

    // Hands: small ovals hanging from the shoulder; the back one in shade.
    for (const hand of [this.backHand, this.frontHand]) {
      hand.texture = parts.hand;
      hand.anchor.set(0.5, 0.06);
      hand.position.set(SHOULDER.x * U, ty(SHOULDER.y));
      fit(hand, ARM_LEN * 1.15);
    }
    this.backHand.tint = 0xd8d2c4;

    // The big leaf: its stalk's foot is at the bottom left of the picture. Held at
    // the stalk's foot and mirrored, so the blade spreads back over the body.
    this.leafUmbrella.texture = parts['leaf-umbrella'];
    this.leafUmbrella.anchor.set(0.06, 0.985);
    fit(this.leafUmbrella, BODY_H * 0.95);
    this.leafUmbrella.scale.x = -Math.abs(this.leafUmbrella.scale.x);

    // Lantern: hangs from its handle in the hand.
    this.lantern.texture = parts.lantern;
    this.lantern.anchor.set(0.5, 0.02);
    fit(this.lantern, LANTERN_H);

    this.leafBase = { x: this.leaf.scale.x, y: this.leaf.scale.y };
    this.scarfBase = { x: this.scarf.scale.x, y: this.scarf.scale.y };
    this.trunk.visible = true;
    this.backLeg.visible = true;
    this.frontLeg.visible = true;
    this.pose();
  }

  /* ----------------------------------------------------------- gestures */

  /** Every so often, something small: which one depends on whether it is walking, sitting, wet or cold. */
  private gestures(dt: number): void {
    const st = this.state!;
    if (this.gesture !== 'none') {
      this.gestureLeft -= dt;
      if (this.gestureLeft <= 0) {
        const ended = this.gesture;
        this.gesture = 'none';
        this.nextGesture = 9 + Math.random() * 16;
        if (ended === 'sulk') this.begin('candy');
        else this.chooseEyes();
      }
      return;
    }
    this.nextGesture -= dt;
    if (this.nextGesture > 0) return;
    const r = Math.random();
    if (this.asleep) return;
    if (st.pace <= 0) {
      // Aboard a train or plane: mostly watching the window go by. Resting: a doze, a stretch, or a look around.
      if (this.mode !== 'walk') this.begin(r < 0.6 ? 'window' : r < 0.8 ? 'doze' : 'lookaround');
      else this.begin(r < 0.45 ? 'doze' : r < 0.7 ? 'stretch' : 'lookaround');
      return;
    }
    if (st.umbrella && r < 0.15) this.begin('shake');
    else if (r < 0.3) this.begin('hop');
    else if (r < 0.42) this.begin('kick');
    else if (r < 0.6 && this.allowPause) this.begin('gaze');
    else if (r < 0.8 && this.allowPause) this.begin('lookaround');
    else this.begin('glance');
  }

  /** Which eyes to show for the moment. */
  private chooseEyes(): void {
    const st = this.state;
    if (this.asleep) {
      this.setEyes('closed');
      return;
    }
    switch (this.gesture) {
      case 'glance':
      case 'wave':
      case 'tickle':
      case 'candy':
        this.setEyes('smile');
        return;
      case 'lookaround':
      case 'boing':
        this.setEyes('front');
        return;
      case 'sulk':
        this.setEyes('flat');
        return;
      case 'stretch':
      case 'doze':
        this.setEyes('closed');
        return;
      default:
        this.setEyes(st && st.windLean > 0.6 ? 'squint' : 'side');
    }
  }

  /** A quick blink every few seconds; smiles, squints and closed eyes do not blink. */
  private blink(dt: number): void {
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt;
      this.eyes.scale.y = this.blinkLeft > 0 ? 0.15 : 1;
      return;
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.nextBlink = 2.5 + Math.random() * 4;
      if (this.eyeMode === 'side' || this.eyeMode === 'front') this.blinkLeft = 0.12;
    }
  }

  /** While the wanderling sleeps a firefly drifts about its head, pulsing softly. */
  private fly(dt: number): void {
    void dt;
    const show = this.asleep && this.trunk.visible;
    this.firefly.visible = show;
    if (!show) return;
    const t = this.time;
    const u = U * this.scale;
    const x = this.feet.x + (0.25 + 0.4 * Math.sin(t * 0.6) + 0.1 * Math.sin(t * 1.7)) * u;
    const y = this.feet.y - (0.85 + 0.22 * Math.sin(t * 0.9 + 1) + 0.06 * Math.sin(t * 2.3)) * u;
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6));
    this.firefly.clear();
    this.firefly.circle(x, y, 0.14 * u).fill({ color: WANDERER.glow, alpha: 0.08 * pulse });
    this.firefly.circle(x, y, 0.07 * u).fill({ color: WANDERER.glow, alpha: 0.18 * pulse });
    this.firefly.circle(x, y, 0.025 * u).fill({ color: WANDERER.glow, alpha: 0.95 * pulse });
  }

  /** Below freezing: now and then a short shiver. */
  private shiver(dt: number): void {
    if (this.shiverLeft > 0) {
      this.shiverLeft -= dt;
      return;
    }
    if (!this.cold) return;
    this.nextShiver -= dt;
    if (this.nextShiver <= 0) {
      this.nextShiver = 5 + Math.random() * 5;
      this.shiverLeft = 0.6;
    }
  }

  /** In the cold, a small white puff drifts up from the face now and then. */
  private breathe(dt: number): void {
    if (this.breathLeft > 0) {
      this.breathLeft -= dt;
      const k = 1 - Math.max(0, this.breathLeft) / 1.4;
      this.breath.visible = this.breathLeft > 0;
      this.breath.alpha = 0.55 * (1 - k) * Math.min(1, k * 6);
      this.breath.scale.set(0.6 + k * 0.9);
      this.breath.position.set((EYE_SIDE.x + 0.2 + k * 0.1) * U, (EYE_Y + 0.1 - k * 0.14) * U + (this.trunk.y - PIVOT.y * U));
      return;
    }
    this.breath.visible = false;
    if (!this.cold) return;
    this.nextBreath -= dt;
    if (this.nextBreath <= 0) {
      this.nextBreath = 4 + Math.random() * 4;
      this.breathLeft = 1.4;
    }
  }

  private setEyes(mode: EyeMode): void {
    if (mode === this.eyeMode) return;
    this.eyeMode = mode;
    this.eyes.scale.y = 1;
    this.blinkLeft = 0;
    this.drawEyes(mode);
  }

  /* ------------------------------------------------------------- posing */

  private pose(): void {
    const st = this.state;
    if (!st) return;
    const dt = this.lastDt;
    const ease = Math.min(1, dt * 5);
    const slow = Math.min(1, dt * 3);
    const t = this.time;
    const g = this.gesture;
    const k = this.progress;
    const moving = st.pace > 0 && !this.paused ? 1 : 0;

    // Sitting down when there is nowhere to walk: resting at a place, at the
    // end of a route, or aboard a train or plane. Eased, so it sits and rises.
    const sitTarget = ((st.pace <= 0 || this.asleep) && g !== 'wave' && g !== 'stretch') || g === 'sulk' || g === 'candy' ? 1 : 0;
    const asleep = this.asleep ? 1 : 0;
    this.sit += (sitTarget - this.sit) * slow;
    const sit = this.sit;
    const stand = 1 - sit;

    // Gait: each boot swings forward through the air, then stands while the
    // ground carries it back. The two are half a cycle apart. A hop lifts both.
    const hop = g === 'hop' ? Math.sin(Math.PI * k) : 0;
    let airborne = hop;
    [this.frontLeg, this.backLeg].forEach((leg, i) => {
      const ph = this.phase + i * Math.PI;
      // A kick: the front boot swings well forward once, then falls back.
      const kick = g === 'kick' && i === 0 ? Math.sin(Math.PI * Math.min(1, Math.max(0, (k - 0.1) / 0.5))) : 0;
      const forward = -Math.sin(ph) * STEP_SWING * moving - kick * 1.1;
      const lift = Math.max(Math.max(0, Math.cos(ph)) * moving, hop);
      airborne = Math.max(airborne, lift);
      const side = i === 0 ? 1 : -1;
      // Standing: hanging from the hip. Sitting: stuck out in front, toes up.
      leg.rotation = (forward * 0.6 - lift * 0.25 - hop * 0.4) * stand - 1.35 * sit;
      if (kick > 0) leg.position.y -= kick * 0.05 * U;
      leg.position.y = (BODY_BOTTOM - 0.03) * U - lift * STEP_LIFT * U * stand + sit * 0.07 * U;
      leg.position.x = (side * BODY_HALF_W * 0.3 + Math.sin(ph) * 0.11 * moving) * U * stand + (0.22 + side * 0.06) * U * sit;
    });

    // The body: a hop with each step, squashing as it lands and stretching as
    // it rises; a slow breath when standing or sitting. Rocks with the stride.
    const bob = -airborne * (0.03 + hop * 0.1) * U;
    this.trunk.y = PIVOT.y * U + bob + sit * 0.075 * U;
    const breath = 1 + (0.012 + asleep * 0.012) * Math.sin(t * (1.6 - asleep * 0.7));
    let stretch = moving ? 1 + 0.035 * (airborne - 0.5) * 2 : breath;
    if (g === 'stretch') stretch *= 1 + 0.07 * Math.sin(Math.PI * k);
    if (hop > 0) stretch *= 1 + 0.05 * hop;
    this.trunk.scale.set(1 - (stretch - 1) * 0.8, stretch);
    this.shadow.scale.set((1 - airborne * 0.12) * (1 + sit * 0.3), 1);
    this.shadow.alpha = 1 - airborne * 0.3;
    // A shiver in the cold: a quick side to side.
    this.trunk.x = PIVOT.x * U + (this.shiverLeft > 0 ? Math.sin(t * 48) * 0.012 * U : 0);

    // Gazing: the whole body eases back to look up at the sky. Wind: it leans in.
    // Sitting: leans back on the pack. Waving: leans towards the viewer a touch.
    let tiltTarget = g === 'gaze' ? -0.3 : 0;
    if (g === 'wave' || g === 'candy') tiltTarget = -0.08;
    if (g === 'sulk') tiltTarget = -0.16;
    if (g === 'boing') tiltTarget = -0.12;
    this.tilt += (tiltTarget - this.tilt) * ease;
    this.lean += (st.windLean * 0.28 + moving * 0.05 - this.lean) * ease;
    const rock = moving ? Math.sin(this.phase) * 0.03 : Math.sin(t * 0.8) * 0.03 * stand;
    const shake = g === 'shake' ? Math.sin(k * Math.PI * 6) * 0.14 * (1 - k) : g === 'tickle' ? Math.sin(k * Math.PI * 5) * 0.09 * (1 - k) : 0;
    this.trunk.rotation = this.tilt + this.lean + rock + shake - 0.08 * sit - 0.1 * asleep * sit + (g === 'peer' ? 0.06 * Math.sin(Math.PI * k) : 0);

    // The leaf: a vane for the real wind, a flutter on top, and it perks up
    // (stands straighter, a little taller) when something is interesting,
    // droops when dozing. It has weight: it follows the body a beat late.
    const perkTarget = g === 'gaze' || g === 'lookaround' || g === 'glance' || g === 'wave' || g === 'peer' || g === 'window' || g === 'boing' || g === 'candy' ? 1 : 0;
    this.perk += (perkTarget - this.perk) * ease;
    this.droop += ((g === 'doze' || this.asleep ? 1 : 0) - this.droop) * slow;
    const gust = Math.abs(this.wind);
    const flutter = Math.sin(t * (2.2 + gust * 7)) * (0.05 + gust * 0.14 + st.windLean * 0.1);
    // In a strong wind the leaf lies back whatever the compass says, as on the pose sheet.
    const vane = this.wind * (0.55 + st.windLean * 0.4) * (1 - this.perk * 0.6) - st.windLean * 0.7;
    // The world's say: rain, heat and dark make it hang; cold makes it stiff; it leans to the sun.
    const env = this.leafEnv;
    const hang = Math.min(1, this.droop + env.droop + (g === 'sulk' ? 1 : 0));
    const give = 1 - env.stiff * 0.7;
    // At rest the leaf curls a little forward, as on the sheet; the world bends it from there.
    spring(this.leafSpring, 0.18 + (vane + flutter * (1 - this.perk * 0.5)) * give - this.perk * 0.1 - hang * 0.9, dt, 40 + env.stiff * 60, 5 + env.stiff * 6);
    // The stalk's foot turns with the head only partly, so the leaf keeps something of its own upright.
    const baseAngle = -this.trunk.rotation * 0.6 + env.toSun * 0.14 * give;
    // The stalk can only curl so far before it would look snapped.
    this.shapeLeaf(baseAngle, Math.max(-1.05, Math.min(1.05, this.leafSpring.a)), flutter * 0.5 * give);
    const leafScale = 1 + this.perk * 0.12 - hang * 0.05;
    this.leaf.scale.set(this.leafBase.x * leafScale, this.leafBase.y * leafScale);

    // The backpack sits loosely: it swings back a little when the body rocks.
    spring(this.packSpring, 0, dt, 90, 10);
    this.backpack.rotation = this.packSpring.a - this.trunk.rotation * 0.5;

    // Hands: swing opposite the same-side leg, lagging like pendulums; rest
    // when sitting; both up for a stretch; one up and waving for a wave. The
    // leaf umbrella takes the front hand, the lantern whichever is free.
    let frontTarget = Math.sin(this.phase) * 0.45 * moving;
    let backTarget = -Math.sin(this.phase) * 0.45 * moving;
    if (g === 'stretch') {
      const up = Math.sin(Math.PI * k);
      frontTarget = -2.6 * up;
      backTarget = 2.6 * up;
    }
    if (st.umbrella) frontTarget = -2.7 + Math.sin(this.phase) * 0.03;
    if (st.lantern) {
      if (st.umbrella) backTarget = 0.6 + Math.sin(this.phase) * 0.04;
      else frontTarget = -0.55 + Math.sin(this.phase) * 0.05;
    }
    if (g === 'candy') {
      // Holds the sweet out, up and forward, for whoever is watching.
      const up = Math.min(1, k * 3) * Math.min(1, (1 - k) * 4);
      frontTarget = -1.7 * up;
    }
    if (g === 'wave') {
      const up = Math.min(1, k * 4) * Math.min(1, (1 - k) * 4);
      const waving = -2.4 * up + Math.sin(t * 13) * 0.35 * up;
      if (st.umbrella) backTarget = -waving;
      else frontTarget = waving;
    }
    spring(this.frontHandSpring, frontTarget, dt, 70, 9);
    spring(this.backHandSpring, backTarget, dt, 70, 9);
    const frontRot = this.frontHandSpring.a;
    const backRot = this.backHandSpring.a;
    this.frontHand.rotation = frontRot;
    this.backHand.rotation = backRot;

    if (st.umbrella) {
      const hand = handOf(frontRot);
      this.leafUmbrella.position.set(hand.x * U, hand.y * U);
      // Tip into the wind a little, sway with the stride a little, flap when shaken.
      this.leafUmbrella.rotation = -this.wind * 0.3 + Math.sin(this.phase) * 0.02 + shake * 0.6;
    }
    if (st.lantern) {
      // The lantern moves to the back hand while the front one waves.
      const hand = handOf(st.umbrella || g === 'wave' ? backRot : frontRot);
      // The lantern hangs plumb and swings after the hand, not with it.
      spring(this.lanternSpring, -this.trunk.rotation - (hand.x - this.lanternLastX) * 6, dt, 50, 6);
      this.lanternLastX = hand.x;
      const rot = this.lanternSpring.a;
      this.lantern.position.set(hand.x * U, hand.y * U);
      this.lantern.rotation = rot;
      // The glow follows the glass, which hangs below the handle and swings with it.
      // The hand lives in the trunk, so account for the trunk's offset, scale and rotation.
      const drop = LANTERN_H * LANTERN_GLASS;
      const gx = hand.x + drop * Math.sin(rot);
      const gy = (hand.y + drop * Math.cos(rot)) * this.trunk.scale.y;
      const c = Math.cos(this.trunk.rotation);
      const sn = Math.sin(this.trunk.rotation);
      const wx = PIVOT.x + gx * c - gy * sn;
      const wy = this.trunk.y / U + gx * sn + gy * c;
      this.glow.position.set(this.feet.x + wx * U * this.scale, this.feet.y + wy * U * this.scale);
    }

    // The scarf tail ripples behind, lifted and stretched by the wind; shorter when wrapped tight.
    this.shapeTail(this.cold ? 0.65 : 1, this.wind, st.windLean);
    this.tail.rotation = this.wind * 0.25 + st.windLean * 0.2 + sit * 0.3;
    // Wrapped tight: the band is thicker.
    this.scarf.scale.set(this.scarfBase.x, this.scarfBase.y * (this.cold ? 1.45 : 1));

    // The sweet appears in the front hand after a sulk, then is gone.
    if (g === 'candy') {
      const hand = handOf(frontRot);
      this.candy.visible = true;
      this.candy.position.set(hand.x * U, hand.y * U);
      this.candy.rotation = frontRot * 0.3;
      this.candy.alpha = Math.min(1, k * 4) * Math.min(1, (1 - k) * 5);
      this.candy.scale.set(0.8 + 0.2 * Math.min(1, k * 3));
    } else {
      this.candy.visible = false;
    }

    // The pebble: lies ahead of the front boot, flies off in a little arc when
    // kicked, bounces once and rolls out of sight.
    if (g === 'kick') {
      this.pebble.visible = true;
      const start = 0.38;
      if (k < start) {
        this.pebble.position.set((BODY_HALF_W * 0.3 + 0.2) * U, -0.012 * U);
        this.pebble.alpha = Math.min(1, k * 6);
      } else {
        const f = (k - start) / (1 - start);
        const x = (BODY_HALF_W * 0.3 + 0.2 + f * 0.9) * U;
        const arc = f < 0.6 ? Math.sin((f / 0.6) * Math.PI) * 0.16 : Math.sin(((f - 0.6) / 0.4) * Math.PI) * 0.04;
        this.pebble.position.set(x, -0.012 * U - arc * U);
        this.pebble.rotation = f * 7;
        this.pebble.alpha = f > 0.85 ? 1 - (f - 0.85) / 0.15 : 1;
      }
    } else {
      this.pebble.visible = false;
    }

    // Eyes: up while gazing, left then right while looking around, a tiny
    // drift of attention while walking, down a little while sitting.
    let lookX = 0.008 * U * Math.sin(t * 0.6) * moving;
    let lookY = this.gesture === 'gaze' ? -0.035 : sit * 0.012;
    if (g === 'sulk') {
      // Looks away, over its shoulder.
      lookX = -0.03 * U * Math.min(1, k * 4);
    }
    if (g === 'boing') lookY = -0.03;
    if (g === 'window' || g === 'peer') {
      // Out of the window, or at the signpost ahead: forward and a little up.
      const settle = Math.min(1, k * 5) * Math.min(1, (1 - k) * 5);
      lookX = 0.03 * U * settle;
      lookY = -0.015 * settle;
    }
    if (g === 'lookaround') {
      const side = k < 0.5 ? -1 : 1;
      const settle = Math.min(1, ((k % 0.5) / 0.5) * 6);
      lookX = side * 0.035 * U * settle;
      lookY = -0.005;
    }
    this.eyes.position.set(lookX, ty(EYE_Y) + lookY * U);
  }

  /**
   * Lay the leaf's points from the stalk's foot (at the origin) to the tip.
   * `base` turns the whole leaf, `bend` curls it increasingly towards the tip
   * (positive is forward, to the right), and `flutter` adds a small wave.
   */
  private shapeLeaf(base: number, bend: number, flutter: number): void {
    const tex = this.leafTexture;
    if (!tex || !this.leafRope) return;
    const n = this.leafPoints.length;
    const seg = tex.width / (n - 1);
    let x = 0;
    let y = 0;
    this.leafPoints[0].set(0, 0);
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      const a = base + bend * Math.pow(f, 1.3) + flutter * Math.sin(f * 3 - this.time * 2);
      x += seg * Math.sin(a);
      y -= seg * Math.cos(a);
      this.leafPoints[i].set(x, y);
    }
  }

  /** A small wrapped sweet: brick-red middle, paper twists at the ends. */
  private drawCandy(): void {
    const c = this.candy;
    const r = 0.05 * U;
    const line = { color: WANDERER.ink, width: STROKE * 0.9, join: 'round' as const };
    c.poly([-r * 1.1, 0, -r * 1.9, -r * 0.8, -r * 1.7, 0, -r * 1.9, r * 0.8]).fill({ color: WANDERER.breath }).stroke(line);
    c.poly([r * 1.1, 0, r * 1.9, -r * 0.8, r * 1.7, 0, r * 1.9, r * 0.8]).fill({ color: WANDERER.breath }).stroke(line);
    c.circle(0, 0, r).fill({ color: WANDERER.scarf }).stroke(line);
    c.circle(-r * 0.35, -r * 0.35, r * 0.25).fill({ color: WANDERER.breath, alpha: 0.8 });
  }

  /**
   * Lay the scarf tail's points along a wave. `len` scales the length, the
   * wind lifts and straightens it, and the ripple grows towards the tip.
   * Points run from the tip (texture left) to the knot (texture right).
   */
  private shapeTail(len: number, wind: number, windLean: number): void {
    const tex = this.tailTexture;
    if (!tex || !this.tailRope) return;
    const w = tex.width;
    const h = tex.height;
    const n = this.tailPoints.length;
    const t = this.time;
    const ripple = h * (0.28 + windLean * 0.3 + Math.abs(wind) * 0.2);
    for (let i = 0; i < n; i++) {
      const f = 1 - i / (n - 1); // 0 at the knot, 1 at the tip
      const x = -w * len * f * (1 - windLean * 0.05);
      const wave = Math.sin(t * 3.2 - f * 3.6) * ripple * Math.pow(f, 1.4);
      const lift = -windLean * h * 0.9 * f * f;
      this.tailPoints[i].set(x, h * 0.4 + wave + lift);
    }
  }


  /* ------------------------------------------------------------ drawing */

  /** A puff of breath: three soft discs, drawn once and animated by alpha and scale. */
  private drawBreath(): void {
    this.breath.circle(0, 0, 0.05 * U).fill({ color: WANDERER.breath });
    this.breath.circle(0.05 * U, -0.02 * U, 0.04 * U).fill({ color: WANDERER.breath });
    this.breath.circle(-0.03 * U, -0.04 * U, 0.035 * U).fill({ color: WANDERER.breath });
  }

  /** Two ink dots. From the side one shows; turned to the viewer both do, as dots or a smile; a squint in a gale; closed when dozing. */
  private drawEyes(mode: EyeMode): void {
    const ink = WANDERER.ink;
    const e = this.eyes;
    e.clear();
    // Scale the blink about the eye line.
    e.pivot.set(0, ty(EYE_Y));
    e.position.set(0, ty(EYE_Y));
    if (mode === 'side') {
      e.circle(EYE_SIDE.x * U, ty(EYE_SIDE.y), EYE_R * U).fill({ color: ink });
      return;
    }
    if (mode === 'squint') {
      // Two small ">" marks, one on the face and a hint of the other, eyes pressed shut against the wind.
      const r = EYE_R * 1.6;
      for (const x of [EYE_SIDE.x, EYE_SIDE.x - BODY_HALF_W * 0.45]) {
        e.moveTo((x - r) * U, ty(EYE_Y) - r * U)
          .lineTo(x * U, ty(EYE_Y))
          .lineTo((x - r) * U, ty(EYE_Y) + r * U)
          .stroke({ color: ink, width: STROKE * 1.6, cap: 'round', join: 'round' });
      }
      return;
    }
    if (mode === 'front') {
      for (const p of EYE_FRONT) e.circle(p.x * U, ty(p.y), EYE_R * U).fill({ color: ink });
      return;
    }
    if (mode === 'flat') {
      // Two short level lines: unimpressed.
      const r = EYE_R * 1.3;
      for (const x of [EYE_SIDE.x, EYE_SIDE.x - BODY_HALF_W * 0.45]) {
        e.moveTo((x - r) * U, ty(EYE_Y)).lineTo((x + r) * U, ty(EYE_Y)).stroke({ color: WANDERER.ink, width: STROKE * 1.7, cap: 'round' });
      }
      return;
    }
    if (mode === 'closed') {
      // Two short, gently drooping arcs at eye height; not a mouth-like curve.
      const r = EYE_R * 1.4;
      for (const x of [EYE_SIDE.x, EYE_SIDE.x - BODY_HALF_W * 0.45]) {
        e.moveTo((x - r) * U, ty(EYE_Y) - r * 0.2 * U)
          .quadraticCurveTo(x * U, ty(EYE_Y) + r * 0.5 * U, (x + r) * U, ty(EYE_Y) - r * 0.2 * U)
          .stroke({ color: ink, width: STROKE * 1.6, cap: 'round' });
      }
      return;
    }
    for (const p of EYE_FRONT) {
      const r = EYE_R * 1.8;
      e.moveTo((p.x - r) * U, ty(p.y) + r * 0.5 * U)
        .bezierCurveTo((p.x - r * 0.4) * U, ty(p.y) - r * 1.1 * U, (p.x + r * 0.4) * U, ty(p.y) - r * 1.1 * U, (p.x + r) * U, ty(p.y) + r * 0.5 * U)
        .stroke({ color: ink, width: STROKE * 1.8, cap: 'round' });
    }
  }

  private drawGlow(strength: number): void {
    this.glow.clear();
    if (strength <= 0.01) {
      this.glow.visible = false;
      return;
    }
    this.glow.visible = true;
    // Stacked faint discs make a soft halo without a gradient texture.
    for (const [radius, alpha] of [
      [0.72, 0.03],
      [0.56, 0.035],
      [0.42, 0.04],
      [0.3, 0.05],
      [0.19, 0.06],
    ] as const) {
      this.glow.circle(0, 0, radius * U).fill({ color: WANDERER.glow, alpha: alpha * strength });
    }
    // The flame itself.
    this.glow.circle(0, 0, 0.036 * U).fill({ color: WANDERER.glow, alpha: 0.9 * strength });
  }
}

/** Where the hand ends up for an arm rotation, in trunk units (relative to the pivot). */
function handOf(rotation: number): { x: number; y: number } {
  return {
    x: SHOULDER.x - ARM_LEN * Math.sin(rotation),
    y: SHOULDER.y - PIVOT.y + ARM_LEN * Math.cos(rotation),
  };
}

/** One step of a damped spring: `a` chases `target` with stiffness `k` and damping `c`. */
function spring(sp: { a: number; v: number }, target: number, dt: number, k: number, c: number): void {
  const step = Math.min(dt, 0.05);
  sp.v += ((target - sp.a) * k - sp.v * c) * step;
  sp.a += sp.v * step;
}
