import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WANDERER } from '../core/palette';
import type { RenderState, WandererState } from '../core/types';

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

type Gesture = 'none' | 'gaze' | 'glance';
type EyeMode = 'side' | 'front' | 'squint';

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
  private leaf = new Sprite();
  private eyes = new Graphics();
  private scarf = new Sprite();
  private scarfTail = new Sprite();
  private leafUmbrella = new Sprite();
  private lantern = new Sprite();
  private breath = new Graphics();

  private state: WandererState | null = null;
  private wind = 0;
  private phase = 0;
  private time = 0;
  private feet = { x: 0, y: 0 };
  private scale = 1;
  private gesture: Gesture = 'none';
  private gestureLeft = 0;
  private nextGesture = 18;
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
  private tailBase = { x: 1, y: 1 };
  private scarfBase = { x: 1, y: 1 };
  /** The renderer clears this while a signpost is near, so pauses never fight an arrival. */
  allowPause = true;

  constructor() {
    this.trunk.position.set(PIVOT.x * U, PIVOT.y * U);
    this.trunk.addChild(
      this.backHand,
      this.backpack,
      this.scarfTail,
      this.body,
      this.leaf,
      this.scarf,
      this.eyes,
      this.frontHand,
      this.lantern,
      this.leafUmbrella,
    );
    this.view.addChild(this.backLeg, this.frontLeg, this.trunk, this.breath);
    // Nothing shows until the pictures are in; the eyes wait with them.
    this.trunk.visible = false;
    this.backLeg.visible = false;
    this.frontLeg.visible = false;
    this.leafUmbrella.visible = false;
    this.lantern.visible = false;
    this.breath.visible = false;
    this.glow.visible = false;
    this.drawBreath();
    this.drawEyes('side');
    void loadParts().then((parts) => this.dress(parts)).catch((err) => console.warn('[wanderling] parts not loaded', err));
  }

  /** True while the wanderling has stopped to look at the sky. */
  get paused(): boolean {
    return this.gesture === 'gaze';
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
    this.drawGlow(w.lantern ? w.lanternGlow : 0);
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
    // A leisurely 1.5 steps a second.
    const pace = this.paused ? 0 : this.state.pace;
    this.phase += dt * Math.PI * 2 * 1.5 * pace;
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

    // Leaf: the stalk's foot is at the bottom left of its picture; it grows from the top of the head.
    this.leaf.texture = parts.leaf;
    this.leaf.anchor.set(0.05, 0.98);
    this.leaf.position.set(-0.01 * U, ty(BODY_TOP) + STROKE * 1.2);
    fit(this.leaf, BODY_H * 0.64);

    // Scarf band: centred on the body at 0.45 H, a touch wider than the body.
    this.scarf.texture = parts['scarf-band'];
    this.scarf.anchor.set(0.5, 0.5);
    this.scarf.position.set(0.01 * U, ty(SCARF_Y));
    // The band is stretched to the body's width and squashed to 0.13 H: the
    // picture is drawn flatter than the body's curve, so it does not keep its aspect.
    this.scarf.width = BODY_HALF_W * 2 * 1.08 * U;
    this.scarf.height = BODY_H * 0.14 * U;

    // Scarf tail: knotted at its right end, behind the body.
    this.scarfTail.texture = parts['scarf-tail'];
    this.scarfTail.anchor.set(0.96, 0.4);
    this.scarfTail.position.set(-BODY_HALF_W * 0.93 * U, ty(SCARF_Y - 0.005));
    fit(this.scarfTail, BODY_H * 0.24);

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
    this.tailBase = { x: this.scarfTail.scale.x, y: this.scarfTail.scale.y };
    this.scarfBase = { x: this.scarf.scale.x, y: this.scarf.scale.y };
    this.trunk.visible = true;
    this.backLeg.visible = true;
    this.frontLeg.visible = true;
    this.pose();
  }

  /* ----------------------------------------------------------- gestures */

  /** Every so often while walking: a few seconds looking up, or a look at the viewer. */
  private gestures(dt: number): void {
    const st = this.state!;
    if (this.gesture !== 'none') {
      this.gestureLeft -= dt;
      if (this.gestureLeft <= 0) {
        this.gesture = 'none';
        this.chooseEyes();
        this.nextGesture = 35 + Math.random() * 50;
      }
      return;
    }
    if (st.pace <= 0) return;
    this.nextGesture -= dt;
    if (this.nextGesture > 0) return;
    if (Math.random() < 0.55 && this.allowPause) {
      this.gesture = 'gaze';
      this.gestureLeft = 3 + Math.random() * 2;
    } else {
      this.gesture = 'glance';
      this.gestureLeft = 1.6 + Math.random() * 0.6;
    }
    this.chooseEyes();
  }

  /** Which eyes to show: a smile for the viewer, a squint in a gale, else one dot in profile. */
  private chooseEyes(): void {
    const st = this.state;
    if (this.gesture === 'glance') this.setEyes('front');
    else if (st && st.windLean > 0.6) this.setEyes('squint');
    else this.setEyes('side');
  }

  /** A quick blink every few seconds; the smile and the squint do not blink. */
  private blink(dt: number): void {
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt;
      this.eyes.scale.y = this.blinkLeft > 0 ? 0.15 : 1;
      return;
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.nextBlink = 2.5 + Math.random() * 4;
      if (this.eyeMode === 'side') this.blinkLeft = 0.12;
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
    const s = Math.sin(this.phase);
    const moving = st.pace > 0 && !this.paused ? 1 : 0;
    const swing = 0.5 * moving;
    const ease = Math.min(1, this.lastDt * 5);

    this.frontLeg.rotation = s * swing;
    this.backLeg.rotation = -s * swing;

    // The body rises a touch at each stride and rocks with it; walking it leans a little forward.
    const bob = -Math.abs(s) * 0.025 * U * moving;
    this.trunk.y = PIVOT.y * U + bob;
    // Gazing: the whole body eases back to look up at the sky. Wind: it leans in.
    const gazeTarget = this.gesture === 'gaze' ? -0.3 : 0;
    this.tilt += (gazeTarget - this.tilt) * ease;
    this.lean += (st.windLean * 0.28 + moving * 0.05 - this.lean) * ease;
    const rock = moving ? Math.sin(this.phase * 2) * 0.025 : Math.sin(this.time * 0.8) * 0.03;
    this.trunk.rotation = this.tilt + this.lean + rock;

    // The leaf: a vane for the real wind, a flutter on top, and it perks up
    // (stands straighter, a little taller) when something is interesting.
    const perkTarget = this.gesture !== 'none' ? 1 : 0;
    this.perk += (perkTarget - this.perk) * ease;
    const gust = Math.abs(this.wind);
    const flutter = Math.sin(this.time * (2.2 + gust * 7)) * (0.05 + gust * 0.14 + st.windLean * 0.1);
    // In a strong wind the leaf lies back whatever the compass says, as on the pose sheet.
    const vane = this.wind * (0.55 + st.windLean * 0.4) * (1 - this.perk * 0.6) - st.windLean * 0.7;
    this.leaf.rotation = vane + flutter * (1 - this.perk * 0.5) - this.perk * 0.08;
    const leafScale = 1 + this.perk * 0.12;
    this.leaf.scale.set(this.leafBase.x * leafScale, this.leafBase.y * leafScale);

    // Hands: the leaf umbrella takes the front hand, the lantern whichever is free.
    let frontRot = -s * swing * 0.6;
    let backRot = s * swing * 0.6;
    if (st.umbrella) frontRot = -2.7 + s * 0.03;
    if (st.lantern) {
      if (st.umbrella) backRot = 0.6 + s * 0.04;
      else frontRot = -0.55 + s * 0.05;
    }
    this.frontHand.rotation = frontRot;
    this.backHand.rotation = backRot;

    if (st.umbrella) {
      const hand = handOf(frontRot);
      this.leafUmbrella.position.set(hand.x * U, hand.y * U);
      // Tip into the wind a little, sway with the stride a little.
      this.leafUmbrella.rotation = -this.wind * 0.3 + s * 0.02;
    }
    if (st.lantern) {
      const hand = handOf(st.umbrella ? backRot : frontRot);
      const rot = Math.sin(this.phase - 0.6) * 0.12 * moving;
      this.lantern.position.set(hand.x * U, hand.y * U);
      this.lantern.rotation = rot;
      // The glow follows the glass, which hangs below the handle and swings with it.
      // The hand lives in the trunk, so account for the trunk's offset and rotation.
      const drop = LANTERN_H * LANTERN_GLASS;
      const gx = hand.x + drop * Math.sin(rot);
      const gy = hand.y + drop * Math.cos(rot);
      const c = Math.cos(this.trunk.rotation);
      const sn = Math.sin(this.trunk.rotation);
      const wx = PIVOT.x + gx * c - gy * sn;
      const wy = this.trunk.y / U + gx * sn + gy * c;
      this.glow.position.set(this.feet.x + wx * U * this.scale, this.feet.y + wy * U * this.scale);
    }
    // The scarf tail streams behind, blown about by the wind; shorter when wrapped tight.
    this.scarfTail.rotation = Math.sin(this.time * 2.2) * 0.08 + this.wind * 0.4 + st.windLean * 0.3;
    const tailLen = this.cold ? 0.65 : 1;
    this.scarfTail.scale.set(this.tailBase.x * tailLen, this.tailBase.y);
    // Wrapped tight: the band is thicker.
    this.scarf.scale.set(this.scarfBase.x, this.scarfBase.y * (this.cold ? 1.45 : 1));
  }

  /* ------------------------------------------------------------ drawing */

  /** A puff of breath: three soft discs, drawn once and animated by alpha and scale. */
  private drawBreath(): void {
    this.breath.circle(0, 0, 0.05 * U).fill({ color: WANDERER.breath });
    this.breath.circle(0.05 * U, -0.02 * U, 0.04 * U).fill({ color: WANDERER.breath });
    this.breath.circle(-0.03 * U, -0.04 * U, 0.035 * U).fill({ color: WANDERER.breath });
  }

  /** Two ink dots. From the side one shows; turned to the viewer both do, bent into a smile; in a gale they squint. */
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
