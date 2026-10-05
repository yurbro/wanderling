import { Container, Graphics } from 'pixi.js';
import { WANDERER } from '../core/palette';
import type { RenderState, WandererState } from '../core/types';

/**
 * The wanderling: a small bean-shaped creature with a leaf on its head, drawn
 * in code from eight moving parts: body, leaf, eyes, scarf tail, backpack,
 * two legs and two tiny hands (docs/design/decisions.md section 5).
 *
 * The design lives in a unit space where the feet stand at y = 0 and the top
 * of the body is near y = -0.86, facing right. Shapes are drawn at U pixels
 * per unit (so curves tessellate smoothly) and the whole figure is then
 * scaled to the height the renderer asks for.
 *
 * The leaf is a weather vane: it sways with the real wind. In a strong wind
 * the body leans in and the leaf and scarf stream to one side. When it rains
 * the wanderling holds a big leaf up as an umbrella; after sunset it carries
 * a small lantern (its glow and flame live in a separate, untinted layer
 * behind the figure). Below freezing the scarf is wrapped tight and a puff
 * of breath shows now and then.
 *
 * Now and then the wanderling stops to look at the sky (the renderer holds
 * the world still while `paused`), or turns to look at whoever is watching:
 * both eyes, bent into a smile.
 */

type Gesture = 'none' | 'gaze' | 'glance';

const U = 100;
/** The arms are stubs; the hand sits this far from the shoulder. */
const ARM_LEN = 0.16;
const SHOULDER = { x: 0.1, y: -0.42 };
const HIP = { x: 0.0, y: -0.1 };
/** Where the trunk pivots: just above the legs. */
const PIVOT = { x: 0, y: -0.1 };
const STROKE = 0.012 * U;
/** Where the lantern's glass sits below the hand, in units. */
const LANTERN_GLASS = { x: 0, y: 0.105 };
/** The leaf grows from here, on top of the body. */
const LEAF_ROOT = { x: 0.02, y: -0.85 };
/** The side-view eye and the pair seen from the front. */
const EYE_SIDE = { x: 0.14, y: -0.6 };
const EYE_FRONT = [
  { x: -0.07, y: -0.6 },
  { x: 0.09, y: -0.6 },
];

export class Wanderer {
  /** The figure; tinted by day and night. Add this above the ground. */
  readonly view = new Container();
  /** The lantern's halo and flame; add this just behind the figure, untinted. */
  readonly glow = new Graphics();

  /** Everything above the legs: rotates for the walking bob, the gaze and the lean. */
  private trunk = new Container();
  private backHand = new Graphics();
  private frontHand = new Graphics();
  private backLeg = new Graphics();
  private frontLeg = new Graphics();
  private body = new Graphics();
  private backpack = new Graphics();
  private leaf = new Graphics();
  private eyes = new Graphics();
  private scarf = new Graphics();
  private scarfTail = new Graphics();
  private leafUmbrella = new Graphics();
  private lantern = new Graphics();
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
  private eyeMode: 'side' | 'front' = 'side';
  private blinkLeft = 0;
  private nextBlink = 3;
  private breathLeft = 0;
  private nextBreath = 4;
  /** The renderer clears this while a signpost is near, so pauses never fight an arrival. */
  allowPause = true;

  constructor() {
    this.drawParts();
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
    this.leafUmbrella.visible = false;
    this.lantern.visible = false;
    this.breath.visible = false;
    this.glow.visible = false;
    this.drawEyes('side', false);
  }

  /** True while the wanderling has stopped to look at the sky. */
  get paused(): boolean {
    return this.gesture === 'gaze';
  }

  /** Place the feet at (x, groundY) and scale the figure to `height` pixels. */
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
    this.drawScarf(w.cold);
    this.drawGlow(w.lantern ? w.lanternGlow : 0);
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

  /** Every so often while walking: a few seconds looking up, or a look at the viewer. */
  private gestures(dt: number): void {
    const st = this.state!;
    if (this.gesture !== 'none') {
      this.gestureLeft -= dt;
      if (this.gestureLeft <= 0) {
        this.gesture = 'none';
        this.setEyes('side');
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
      this.setEyes('front');
    }
  }

  /** A quick blink every few seconds; the glance at the viewer is a smile instead. */
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
    const cold = this.state?.cold ?? false;
    if (this.breathLeft > 0) {
      this.breathLeft -= dt;
      const k = 1 - Math.max(0, this.breathLeft) / 1.4;
      this.breath.visible = this.breathLeft > 0;
      this.breath.alpha = 0.55 * (1 - k) * Math.min(1, k * 6);
      const grow = 0.6 + k * 0.9;
      this.breath.scale.set(grow);
      this.breath.position.set((EYE_SIDE.x + 0.14 + k * 0.1) * U, (EYE_SIDE.y + 0.08 - k * 0.14) * U + this.trunk.y);
      return;
    }
    this.breath.visible = false;
    if (!cold) return;
    this.nextBreath -= dt;
    if (this.nextBreath <= 0) {
      this.nextBreath = 4 + Math.random() * 4;
      this.breathLeft = 1.4;
    }
  }

  private setEyes(mode: 'side' | 'front'): void {
    if (mode === this.eyeMode) return;
    this.eyeMode = mode;
    this.eyes.scale.y = 1;
    this.drawEyes(mode, mode === 'front');
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

    // The body rises a touch at each stride and rocks with it.
    const bob = -Math.abs(s) * 0.025 * U * moving;
    this.trunk.y = PIVOT.y * U + bob;
    // Gazing: the whole body eases back to look up at the sky. Wind: it leans in.
    const gazeTarget = this.gesture === 'gaze' ? -0.3 : 0;
    this.tilt += (gazeTarget - this.tilt) * ease;
    this.lean += (st.windLean * 0.28 - this.lean) * ease;
    const rock = moving ? Math.sin(this.phase * 2) * 0.025 : Math.sin(this.time * 0.8) * 0.03;
    this.trunk.rotation = this.tilt + this.lean + rock;

    // The leaf: a vane for the real wind, a flutter on top, and it perks up
    // (stands straighter, a little taller) when something is interesting.
    const perkTarget = this.gesture !== 'none' ? 1 : 0;
    this.perk += (perkTarget - this.perk) * ease;
    const gust = Math.abs(this.wind);
    const flutter = Math.sin(this.time * (2.2 + gust * 7)) * (0.05 + gust * 0.14 + st.windLean * 0.1);
    const vane = this.wind * (0.55 + st.windLean * 0.7) * (1 - this.perk * 0.6);
    this.leaf.rotation = vane + flutter * (1 - this.perk * 0.5) - this.perk * 0.08;
    this.leaf.scale.set(1 + this.perk * 0.12);

    // Hands: the leaf umbrella takes the front hand, the lantern whichever is free.
    let frontRot = -s * swing * 0.7;
    let backRot = s * swing * 0.7;
    if (st.umbrella) frontRot = -2.6 + s * 0.03;
    if (st.lantern) {
      if (st.umbrella) backRot = 0.6 + s * 0.04;
      else frontRot = -0.5 + s * 0.05;
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
      // The glow follows the glass, which hangs below the hand and swings with it.
      // The hand lives in the trunk, so account for the trunk's offset and rotation.
      const gx = hand.x + LANTERN_GLASS.y * Math.sin(rot);
      const gy = hand.y + LANTERN_GLASS.y * Math.cos(rot);
      const c = Math.cos(this.trunk.rotation);
      const sn = Math.sin(this.trunk.rotation);
      const wx = PIVOT.x + gx * c - gy * sn;
      const wy = this.trunk.y / U + gx * sn + gy * c;
      this.glow.position.set(this.feet.x + wx * U * this.scale, this.feet.y + wy * U * this.scale);
    }
    // The scarf tail streams behind, blown about by the wind.
    this.scarfTail.rotation = Math.sin(this.time * 2.2) * 0.08 + this.wind * 0.4 + st.windLean * 0.25;
  }

  /* ------------------------------------------------------------ drawing */

  private drawParts(): void {
    const ink = WANDERER.ink;
    const line = { color: ink, width: STROKE, join: 'round' as const, cap: 'round' as const };

    // Two short legs: pivot at the hip, pointing down, a rounded foot at the end.
    for (const [leg, dx] of [
      [this.backLeg, -0.06],
      [this.frontLeg, 0.06],
    ] as const) {
      leg.position.set((HIP.x + dx) * U, HIP.y * U);
      leg.roundRect(-0.04 * U, -0.02 * U, 0.08 * U, 0.12 * U, 0.03 * U).fill({ color: WANDERER.legs }).stroke(line);
      leg.ellipse(0.01 * U, 0.09 * U, 0.06 * U, 0.03 * U).fill({ color: WANDERER.legs }).stroke(line);
    }

    // Two tiny hands on stub arms: pivot at the shoulder. The back one is shaded.
    for (const [hand, shade] of [
      [this.backHand, WANDERER.bodyShade],
      [this.frontHand, WANDERER.body],
    ] as const) {
      hand.position.set(SHOULDER.x * U, (SHOULDER.y - PIVOT.y) * U);
      hand.moveTo(0, 0).lineTo(0, (ARM_LEN - 0.03) * U).stroke({ ...line, width: STROKE * 2.2 });
      hand.circle(0, ARM_LEN * U, 0.04 * U).fill({ color: shade }).stroke(line);
    }

    // The backpack, behind the body and bigger than half of it.
    const bp = this.backpack;
    bp.roundRect(-0.46 * U, -0.62 * U, 0.3 * U, 0.46 * U, 0.09 * U).fill({ color: WANDERER.backpack }).stroke(line);
    bp.roundRect(-0.47 * U, -0.66 * U, 0.32 * U, 0.14 * U, 0.06 * U).fill({ color: WANDERER.backpackFlap }).stroke(line);
    bp.roundRect(-0.42 * U, -0.3 * U, 0.2 * U, 0.1 * U, 0.04 * U).fill({ color: WANDERER.backpackFlap }).stroke(line);
    // A rolled mat on top.
    bp.roundRect(-0.44 * U, -0.72 * U, 0.26 * U, 0.07 * U, 0.035 * U).fill({ color: WANDERER.bodyShade }).stroke(line);

    // The body: one bean, no separate head. Drawn relative to the pivot.
    const b = this.body;
    const y = (v: number) => (v - PIVOT.y) * U;
    b.moveTo(0.02 * U, y(-0.86))
      .bezierCurveTo(0.24 * U, y(-0.86), 0.32 * U, y(-0.6), 0.31 * U, y(-0.36))
      .bezierCurveTo(0.3 * U, y(-0.14), 0.18 * U, y(-0.08), 0, y(-0.08))
      .bezierCurveTo(-0.18 * U, y(-0.08), -0.3 * U, y(-0.14), -0.31 * U, y(-0.36))
      .bezierCurveTo(-0.32 * U, y(-0.6), -0.2 * U, y(-0.86), 0.02 * U, y(-0.86))
      .closePath()
      .fill({ color: WANDERER.body })
      .stroke(line);
    // A soft shade along the back and under the belly, like paper in shadow.
    b.moveTo(-0.14 * U, y(-0.82))
      .bezierCurveTo(-0.3 * U, y(-0.7), -0.33 * U, y(-0.4), -0.22 * U, y(-0.14))
      .bezierCurveTo(-0.27 * U, y(-0.22), -0.26 * U, y(-0.6), -0.14 * U, y(-0.82))
      .closePath()
      .fill({ color: WANDERER.bodyShade, alpha: 0.9 });
    // The strap of the backpack over the shoulder.
    b.moveTo(-0.16 * U, y(-0.76)).bezierCurveTo(0.02 * U, y(-0.66), 0.12 * U, y(-0.5), 0.06 * U, y(-0.3)).stroke({ ...line, width: STROKE * 1.5, alpha: 0.7 });

    // The leaf: pivot at its root on top of the body, pointing up.
    const lf = this.leaf;
    lf.position.set(LEAF_ROOT.x * U, y(LEAF_ROOT.y));
    lf.moveTo(0, 0).lineTo(0.01 * U, -0.07 * U).stroke({ ...line, width: STROKE * 1.4 });
    lf.moveTo(0.01 * U, -0.07 * U)
      .bezierCurveTo(-0.1 * U, -0.1 * U, -0.1 * U, -0.26 * U, 0.03 * U, -0.3 * U)
      .bezierCurveTo(0.14 * U, -0.24 * U, 0.12 * U, -0.1 * U, 0.01 * U, -0.07 * U)
      .closePath()
      .fill({ color: WANDERER.leaf })
      .stroke(line);
    lf.moveTo(0.01 * U, -0.08 * U).lineTo(0.03 * U, -0.27 * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.8, alpha: 0.7 });

    // The big leaf held up as an umbrella: origin at the hand, stalk up to the blade.
    const u = this.leafUmbrella;
    const top = -0.3 * U;
    u.moveTo(0, 0).lineTo(-0.02 * U, top).stroke({ ...line, width: STROKE * 1.6 });
    u.moveTo(-0.44 * U, top + 0.06 * U)
      .bezierCurveTo(-0.3 * U, top - 0.2 * U, 0.2 * U, top - 0.22 * U, 0.42 * U, top - 0.02 * U)
      .bezierCurveTo(0.3 * U, top + 0.04 * U, 0.1 * U, top + 0.02 * U, -0.02 * U, top + 0.03 * U)
      .bezierCurveTo(-0.14 * U, top + 0.02 * U, -0.3 * U, top + 0.05 * U, -0.44 * U, top + 0.06 * U)
      .closePath()
      .fill({ color: WANDERER.leaf })
      .stroke(line);
    u.moveTo(-0.42 * U, top + 0.055 * U).lineTo(0.4 * U, top - 0.02 * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.9, alpha: 0.6 });
    for (const [x0, x1, dy] of [
      [-0.3, -0.26, -0.11],
      [-0.14, -0.09, -0.16],
      [0.04, 0.1, -0.17],
      [0.22, 0.28, -0.13],
    ] as const) {
      u.moveTo(x0 * U, top + 0.045 * U - (x0 + 0.44) * 0.085 * U).lineTo(x1 * U, top + dy * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.7, alpha: 0.45 });
    }

    // Lantern: origin at the hand, hanging below it. The glass is translucent
    // so the untinted flame behind it shows through at night.
    const l = this.lantern;
    l.moveTo(0, 0).lineTo(0, 0.03 * U).stroke(line);
    l.rect(-0.05 * U, 0.03 * U, 0.1 * U, 0.022 * U).fill({ color: ink });
    l.roundRect(-0.042 * U, 0.05 * U, 0.084 * U, 0.11 * U, 0.015 * U).fill({ color: WANDERER.lanternGlass, alpha: 0.35 }).stroke(line);
    l.rect(-0.05 * U, 0.16 * U, 0.1 * U, 0.02 * U).fill({ color: ink });

    // A puff of breath: three soft discs, drawn once and animated by alpha and scale.
    this.breath.circle(0, 0, 0.05 * U).fill({ color: WANDERER.breath });
    this.breath.circle(0.05 * U, -0.02 * U, 0.04 * U).fill({ color: WANDERER.breath });
    this.breath.circle(-0.03 * U, -0.04 * U, 0.035 * U).fill({ color: WANDERER.breath });
  }

  /** The scarf: a band round the body and a tail behind. Tight and short in the cold. */
  private drawScarf(cold: boolean): void {
    const ink = WANDERER.ink;
    const line = { color: ink, width: STROKE, join: 'round' as const, cap: 'round' as const };
    const y = (v: number) => (v - PIVOT.y) * U;
    const sc = this.scarf;
    sc.clear();
    const bandH = cold ? 0.14 : 0.09;
    const bandY = -0.52;
    sc.moveTo(-0.3 * U, y(bandY))
      .bezierCurveTo(-0.15 * U, y(bandY + 0.05), 0.15 * U, y(bandY + 0.05), 0.3 * U, y(bandY))
      .lineTo(0.3 * U, y(bandY + bandH))
      .bezierCurveTo(0.15 * U, y(bandY + bandH + 0.05), -0.15 * U, y(bandY + bandH + 0.05), -0.3 * U, y(bandY + bandH))
      .closePath()
      .fill({ color: WANDERER.scarf })
      .stroke(line);
    if (cold) {
      // A second loop, pulled up over the mouthless chin.
      sc.moveTo(-0.3 * U, y(bandY + 0.06))
        .bezierCurveTo(-0.15 * U, y(bandY + 0.1), 0.15 * U, y(bandY + 0.1), 0.3 * U, y(bandY + 0.06))
        .stroke({ ...line, alpha: 0.5 });
    }

    const tail = this.scarfTail;
    tail.clear();
    tail.position.set(-0.27 * U, y(bandY + 0.04));
    const len = cold ? 0.16 : 0.26;
    tail
      .moveTo(0, -0.03 * U)
      .bezierCurveTo(-len * 0.5 * U, 0, -len * U, 0.02 * U, -len * U, 0.1 * U)
      .lineTo(-len * 0.85 * U, 0.12 * U)
      .bezierCurveTo(-len * 0.6 * U, 0.08 * U, -0.05 * U, 0.08 * U, 0, 0.06 * U)
      .closePath()
      .fill({ color: WANDERER.scarf })
      .stroke(line);
    // Fringe at the end.
    for (const dy of [0.0, 0.04, 0.08]) {
      tail.moveTo(-len * U, (0.03 + dy) * U).lineTo(-(len + 0.03) * U, (0.05 + dy) * U).stroke({ ...line, width: STROKE * 0.8 });
    }
  }

  /** Two ink dots. From the side only one shows; turned to the viewer both do, bent into a smile. */
  private drawEyes(mode: 'side' | 'front', smile: boolean): void {
    const ink = WANDERER.ink;
    const y = (v: number) => (v - PIVOT.y) * U;
    const e = this.eyes;
    e.clear();
    const spots = mode === 'side' ? [EYE_SIDE] : EYE_FRONT;
    // Scale the blink about the eye line.
    e.pivot.set(0, y(EYE_SIDE.y));
    e.position.set(0, y(EYE_SIDE.y));
    for (const p of spots) {
      if (smile) {
        e.moveTo((p.x - 0.035) * U, y(p.y) + 0.012 * U)
          .bezierCurveTo((p.x - 0.015) * U, y(p.y) - 0.03 * U, (p.x + 0.015) * U, y(p.y) - 0.03 * U, (p.x + 0.035) * U, y(p.y) + 0.012 * U)
          .stroke({ color: ink, width: STROKE * 1.8, cap: 'round' });
      } else {
        e.circle(p.x * U, y(p.y), 0.024 * U).fill({ color: ink });
      }
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
