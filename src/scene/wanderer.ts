import { Container, Graphics } from 'pixi.js';
import { WANDERER } from '../core/palette';
import type { RenderState, WandererState } from '../core/types';

/**
 * The wanderling: a small egg-shaped creature with a leaf on its head, drawn
 * in code from eight moving parts: body, leaf, eyes, scarf tail, backpack,
 * two legs and two tiny hands. Proportions follow the turnaround sheet in
 * docs/design/art/ (see its README): with the body height as H, the body is
 * 0.9 H wide, the eyes sit 0.3 H from the top, the scarf band is centred at
 * 0.45 H and 0.1 H wide, the leaf stalk is 0.3 H and the blade 0.35 H, the
 * hands are 0.25 H ovals on the lower half, the boots 0.12 H below the body
 * and the backpack shows 0.3 H wide and 0.6 H tall behind it.
 *
 * The design lives in a unit space where the boots stand at y = 0 and the
 * body is BODY_H units tall, facing right. Shapes are drawn at U pixels per
 * unit (so curves tessellate smoothly) and the whole figure is then scaled
 * to the height the renderer asks for.
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
/** Where the lantern's glass sits below the hand, in units. */
const LANTERN_GLASS_Y = 0.105;
/** The eye line, and the eyes' spots from the side, the front, and squinting. */
const EYE_Y = BODY_TOP + BODY_H * 0.3;
const EYE_SIDE = { x: BODY_HALF_W * 0.62, y: EYE_Y };
const EYE_FRONT = [
  { x: -BODY_HALF_W * 0.3, y: EYE_Y },
  { x: BODY_HALF_W * 0.3, y: EYE_Y },
];
const EYE_R = BODY_H * 0.03;
/** The scarf band, centred at 0.45 H, and where its tail is knotted behind. */
const SCARF_Y = BODY_TOP + BODY_H * 0.45;
const SCARF_W = BODY_H * 0.1;

/** y in trunk space (relative to the pivot) for a y in figure space. */
const ty = (y: number): number => (y - PIVOT.y) * U;

export class Wanderer {
  /** The figure; tinted by day and night. Add this above the ground. */
  readonly view = new Container();
  /** The lantern's halo and flame; add this just behind the figure, untinted. */
  readonly glow = new Graphics();

  /** Everything above the boots: rotates for the walking rock, the gaze and the lean. */
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
  private eyeMode: EyeMode = 'side';
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
    this.drawEyes('side');
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
    this.drawScarf(w.cold);
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
    const cold = this.state?.cold ?? false;
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
    if (!cold) return;
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
    this.leaf.scale.set(1 + this.perk * 0.12);

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
      // The glow follows the glass, which hangs below the hand and swings with it.
      // The hand lives in the trunk, so account for the trunk's offset and rotation.
      const gx = hand.x + LANTERN_GLASS_Y * Math.sin(rot);
      const gy = hand.y + LANTERN_GLASS_Y * Math.cos(rot);
      const c = Math.cos(this.trunk.rotation);
      const sn = Math.sin(this.trunk.rotation);
      const wx = PIVOT.x + gx * c - gy * sn;
      const wy = this.trunk.y / U + gx * sn + gy * c;
      this.glow.position.set(this.feet.x + wx * U * this.scale, this.feet.y + wy * U * this.scale);
    }
    // The scarf tail streams behind, blown about by the wind.
    this.scarfTail.rotation = Math.sin(this.time * 2.2) * 0.08 + this.wind * 0.4 + st.windLean * 0.3;
  }

  /* ------------------------------------------------------------ drawing */

  private drawParts(): void {
    const ink = WANDERER.ink;
    const line = { color: ink, width: STROKE, join: 'round' as const, cap: 'round' as const };

    // Two dark boots: pivot where the leg meets the body, pointing down.
    for (const [leg, dx] of [
      [this.backLeg, -BODY_HALF_W * 0.3],
      [this.frontLeg, BODY_HALF_W * 0.3],
    ] as const) {
      leg.position.set(dx * U, (BODY_BOTTOM - 0.03) * U);
      leg.roundRect(-0.05 * U, 0, 0.1 * U, (BOOT_H + 0.03) * U, 0.035 * U).fill({ color: WANDERER.legs }).stroke(line);
      leg.ellipse(0.015 * U, (BOOT_H + 0.01) * U, 0.065 * U, 0.028 * U).fill({ color: WANDERER.legs }).stroke(line);
    }

    // Two tiny hands: small ovals hanging on the sides of the body, pivot at the top.
    for (const [hand, shade] of [
      [this.backHand, WANDERER.bodyShade],
      [this.frontHand, WANDERER.body],
    ] as const) {
      hand.position.set(SHOULDER.x * U, ty(SHOULDER.y));
      hand.ellipse(0, (ARM_LEN / 2) * U, 0.045 * U, (ARM_LEN / 2) * U).fill({ color: shade }).stroke(line);
    }

    // The backpack: most of it hides behind the body; a rounded pack with a flap and a pocket.
    const bp = this.backpack;
    const bpW = BODY_H * 0.42;
    const bpH = BODY_H * 0.66;
    const bpX = -BODY_HALF_W * 0.72 - bpW;
    const bpY = BODY_TOP + BODY_H * 0.2;
    bp.roundRect(bpX * U, ty(bpY), bpW * U, bpH * U, 0.09 * U).fill({ color: WANDERER.backpack }).stroke(line);
    bp.roundRect((bpX - 0.01) * U, ty(bpY - 0.02), (bpW + 0.02) * U, bpH * 0.24 * U, 0.06 * U).fill({ color: WANDERER.backpackFlap }).stroke(line);
    bp.roundRect((bpX + 0.03) * U, ty(bpY + bpH * 0.6), (bpW - 0.1) * U, bpH * 0.24 * U, 0.04 * U).fill({ color: WANDERER.backpackFlap }).stroke(line);

    // The body: one egg, no separate head. A little wider below the middle.
    const b = this.body;
    const hw = BODY_HALF_W;
    const top = BODY_TOP;
    const bot = BODY_BOTTOM;
    const mid = top + BODY_H * 0.58;
    b.moveTo(0, ty(top))
      .bezierCurveTo(hw * 0.78 * U, ty(top), hw * 0.99 * U, ty(mid - BODY_H * 0.2), hw * U, ty(mid))
      .bezierCurveTo(hw * 0.98 * U, ty(bot - BODY_H * 0.02), hw * 0.55 * U, ty(bot), 0, ty(bot))
      .bezierCurveTo(-hw * 0.55 * U, ty(bot), -hw * 0.98 * U, ty(bot - BODY_H * 0.02), -hw * U, ty(mid))
      .bezierCurveTo(-hw * 0.99 * U, ty(mid - BODY_H * 0.2), -hw * 0.78 * U, ty(top), 0, ty(top))
      .closePath()
      .fill({ color: WANDERER.body })
      .stroke(line);
    // A soft shade along the back, like paper in shadow.
    b.moveTo(-hw * 0.35 * U, ty(top + 0.02))
      .bezierCurveTo(-hw * 0.95 * U, ty(top + BODY_H * 0.25), -hw * 1.0 * U, ty(bot - BODY_H * 0.25), -hw * 0.45 * U, ty(bot - 0.01))
      .bezierCurveTo(-hw * 0.85 * U, ty(bot - BODY_H * 0.25), -hw * 0.82 * U, ty(top + BODY_H * 0.25), -hw * 0.35 * U, ty(top + 0.02))
      .closePath()
      .fill({ color: WANDERER.bodyShade, alpha: 0.8 });

    // The leaf: a curved stalk from the top of the head, pivot at its root, pointing up.
    const lf = this.leaf;
    const stalk = BODY_H * 0.28;
    const blade = BODY_H * 0.34;
    lf.position.set(0, ty(top) + STROKE * 0.5);
    lf.moveTo(0, 0).bezierCurveTo(-0.01 * U, -stalk * 0.5 * U, 0.02 * U, -stalk * 0.8 * U, 0.05 * U, -stalk * U).stroke({ ...line, width: STROKE * 1.3 });
    // The blade leans off to the right from the stalk's tip.
    const bx = 0.05 * U;
    const by = -stalk * U;
    lf.moveTo(bx, by)
      .bezierCurveTo(bx - 0.02 * U, by - blade * 0.45 * U, bx + blade * 0.35 * U, by - blade * 0.95 * U, bx + blade * 0.62 * U, by - blade * 0.78 * U)
      .bezierCurveTo(bx + blade * 0.55 * U, by - blade * 0.3 * U, bx + 0.12 * U, by + 0.02 * U, bx, by)
      .closePath()
      .fill({ color: WANDERER.leaf })
      .stroke(line);
    lf.moveTo(bx + 0.01 * U, by - 0.01 * U).lineTo(bx + blade * 0.5 * U, by - blade * 0.68 * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.7, alpha: 0.6 });

    // The big leaf held up as an umbrella: about three times the head leaf.
    // Origin at the hand, the stalk is the handle, the blade spreads overhead.
    const u = this.leafUmbrella;
    const utop = -0.32 * U;
    u.moveTo(0, 0).lineTo(-0.02 * U, utop).stroke({ ...line, width: STROKE * 1.6 });
    u.moveTo(-0.5 * U, utop + 0.07 * U)
      .bezierCurveTo(-0.34 * U, utop - 0.22 * U, 0.22 * U, utop - 0.25 * U, 0.48 * U, utop - 0.03 * U)
      .bezierCurveTo(0.34 * U, utop + 0.04 * U, 0.1 * U, utop + 0.02 * U, -0.02 * U, utop + 0.03 * U)
      .bezierCurveTo(-0.16 * U, utop + 0.02 * U, -0.34 * U, utop + 0.06 * U, -0.5 * U, utop + 0.07 * U)
      .closePath()
      .fill({ color: WANDERER.leaf })
      .stroke(line);
    u.moveTo(-0.48 * U, utop + 0.065 * U).lineTo(0.46 * U, utop - 0.025 * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.9, alpha: 0.6 });
    for (const [x0, x1, dy] of [
      [-0.34, -0.3, -0.12],
      [-0.16, -0.11, -0.18],
      [0.04, 0.1, -0.19],
      [0.24, 0.3, -0.14],
    ] as const) {
      const y0 = utop + 0.05 * U - (x0 + 0.5) * 0.09 * U;
      u.moveTo(x0 * U, y0).lineTo(x1 * U, utop + dy * U).stroke({ color: WANDERER.leafShade, width: STROKE * 0.7, alpha: 0.45 });
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

  /** The scarf: a band round the body, knotted behind, one tail streaming back. Thick and short in the cold. */
  private drawScarf(cold: boolean): void {
    const ink = WANDERER.ink;
    const line = { color: ink, width: STROKE, join: 'round' as const, cap: 'round' as const };
    const sc = this.scarf;
    sc.clear();
    const w = cold ? SCARF_W * 1.7 : SCARF_W;
    const y0 = SCARF_Y - w / 2;
    const y1 = SCARF_Y + w / 2;
    // The band follows the body's curve: wider than the body by the stroke, bowed downwards in front.
    const hx = BODY_HALF_W * 1.0 + 0.004;
    sc.moveTo(-hx * U, ty(y0 - 0.01))
      .bezierCurveTo(-hx * 0.5 * U, ty(y0 + 0.035), hx * 0.5 * U, ty(y0 + 0.035), hx * U, ty(y0 + 0.005))
      .lineTo(hx * U, ty(y1 + 0.005))
      .bezierCurveTo(hx * 0.5 * U, ty(y1 + 0.035), -hx * 0.5 * U, ty(y1 + 0.035), -hx * U, ty(y1 - 0.01))
      .closePath()
      .fill({ color: WANDERER.scarf })
      .stroke(line);
    if (cold) {
      // A second loop shows as a fold across the band.
      sc.moveTo(-hx * 0.9 * U, ty(SCARF_Y - 0.005))
        .bezierCurveTo(-hx * 0.4 * U, ty(SCARF_Y + 0.03), hx * 0.4 * U, ty(SCARF_Y + 0.03), hx * 0.9 * U, ty(SCARF_Y + 0.01))
        .stroke({ ...line, alpha: 0.45 });
    }

    // The tail: knotted at the back, one piece streaming behind with a notched end.
    const tail = this.scarfTail;
    tail.clear();
    tail.position.set(-BODY_HALF_W * 0.92 * U, ty(y0 + w * 0.3));
    const len = (cold ? 0.26 : 0.44) * BODY_H;
    const th = w * 1.1;
    tail
      .moveTo(0, 0)
      .bezierCurveTo(-len * 0.4 * U, -th * 0.3 * U, -len * 0.75 * U, -th * 0.2 * U, -len * U, -th * 0.1 * U)
      .lineTo(-len * 0.82 * U, th * 0.35 * U)
      .lineTo(-len * U, th * 0.8 * U)
      .bezierCurveTo(-len * 0.7 * U, th * 0.9 * U, -len * 0.35 * U, th * 1.0 * U, 0, th * U)
      .closePath()
      .fill({ color: WANDERER.scarf })
      .stroke(line);
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
