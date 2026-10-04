import { Container, Graphics } from 'pixi.js';
import { WANDERER } from '../core/palette';
import type { RenderState, WandererState } from '../core/types';

/**
 * The little traveler, drawn in code as a paper doll: separate head, torso,
 * arms, legs and backpack so they can swing. The design lives in a unit space
 * where the feet stand at y = 0 and the hat top is near y = -1, facing right.
 * Shapes are drawn at U pixels per unit (so curves tessellate smoothly) and
 * the whole figure is then scaled to the height the renderer asks for.
 *
 * Props follow the RenderState: an umbrella in the front hand when it rains,
 * a lantern once it is dark (its glow and flame live in a separate, untinted
 * layer behind the figure, showing through the translucent glass), and a
 * scarf in the cold.
 */

const U = 100;
const ARM_LEN = 0.27;
const SHOULDER = { x: 0.0, y: -0.64 };
const HIP = { x: 0.0, y: -0.32 };
const STROKE = 0.012 * U;
/** Where the lantern's glass sits below the hand, in units. */
const LANTERN_GLASS = { x: 0, y: 0.105 };

export class Wanderer {
  /** The figure; tinted by day and night. Add this above the ground. */
  readonly view = new Container();
  /** The lantern's halo and flame; add this just behind the figure, untinted. */
  readonly glow = new Graphics();

  private body = new Container();
  private backArm = new Graphics();
  private frontArm = new Graphics();
  private backLeg = new Graphics();
  private frontLeg = new Graphics();
  private torso = new Graphics();
  private backpack = new Graphics();
  private head = new Graphics();
  private scarf = new Graphics();
  private scarfTail = new Graphics();
  private umbrella = new Graphics();
  private lantern = new Graphics();

  private state: WandererState | null = null;
  private wind = 0;
  private phase = 0;
  private time = 0;
  private feet = { x: 0, y: 0 };
  private scale = 1;

  constructor() {
    this.drawParts();
    this.body.addChild(
      this.backArm,
      this.backLeg,
      this.backpack,
      this.torso,
      this.scarfTail,
      this.frontLeg,
      this.scarf,
      this.head,
      this.frontArm,
      this.lantern,
      this.umbrella,
    );
    this.view.addChild(this.body);
    this.umbrella.visible = false;
    this.lantern.visible = false;
    this.scarf.visible = false;
    this.scarfTail.visible = false;
    this.glow.visible = false;
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
    this.umbrella.visible = w.umbrella;
    this.lantern.visible = w.lantern;
    this.scarf.visible = w.scarf;
    this.scarfTail.visible = w.scarf;
    this.view.tint = w.tint;
    this.drawGlow(w.lantern ? w.lanternGlow : 0);
    this.pose();
  }

  frame(dt: number): void {
    if (!this.state) return;
    this.time += dt;
    // A leisurely 1.5 steps a second.
    this.phase += dt * Math.PI * 2 * 1.5 * this.state.pace;
    this.pose();
  }

  /* ------------------------------------------------------------- posing */

  private pose(): void {
    const st = this.state;
    if (!st) return;
    const s = Math.sin(this.phase);
    const moving = st.pace > 0 ? 1 : 0;
    const swing = 0.55 * moving;

    this.frontLeg.rotation = s * swing;
    this.backLeg.rotation = -s * swing;
    // The body rises a touch at each stride.
    this.body.y = -Math.abs(s) * 0.02 * U * moving;
    // Walking: a small nod with each stride. Standing: a slow look around.
    this.head.rotation = moving ? Math.sin(this.phase * 2) * 0.02 : Math.sin(this.time * 0.8) * 0.05;

    // Arms: the umbrella takes the front hand, the lantern whichever is free.
    let frontRot = -s * swing * 0.8;
    let backRot = s * swing * 0.8;
    if (st.umbrella) frontRot = -2.55 + s * 0.03;
    if (st.lantern) {
      if (st.umbrella) backRot = 0.55 + s * 0.04;
      else frontRot = -0.45 + s * 0.05;
    }
    this.frontArm.rotation = frontRot;
    this.backArm.rotation = backRot;

    if (st.umbrella) {
      const hand = handOf(frontRot);
      this.umbrella.position.set(hand.x * U, hand.y * U);
      // Lean into the wind a little, sway with the stride a little.
      this.umbrella.rotation = -this.wind * 0.25 + s * 0.02;
    }
    if (st.lantern) {
      const hand = handOf(st.umbrella ? backRot : frontRot);
      const rot = Math.sin(this.phase - 0.6) * 0.12 * moving;
      this.lantern.position.set(hand.x * U, hand.y * U);
      this.lantern.rotation = rot;
      // The glow follows the glass, which hangs below the hand and swings with it.
      const gx = hand.x + LANTERN_GLASS.y * Math.sin(rot);
      const gy = hand.y + LANTERN_GLASS.y * Math.cos(rot) + this.body.y / U;
      this.glow.position.set(this.feet.x + gx * U * this.scale, this.feet.y + gy * U * this.scale);
    }
    if (st.scarf) {
      this.scarfTail.rotation = Math.sin(this.time * 2.2) * 0.08 + this.wind * 0.35;
    }
  }

  /* ------------------------------------------------------------ drawing */

  private drawParts(): void {
    const ink = WANDERER.ink;
    const line = { color: ink, width: STROKE, join: 'round' as const, cap: 'round' as const };

    // Legs: pivot at the hip, pointing down. Boots in ink.
    for (const [leg, dx] of [
      [this.backLeg, -0.025],
      [this.frontLeg, 0.025],
    ] as const) {
      leg.position.set((HIP.x + dx) * U, HIP.y * U);
      leg.roundRect(-0.045 * U, 0, 0.09 * U, 0.3 * U, 0.035 * U).fill({ color: WANDERER.trousers }).stroke(line);
      leg.roundRect(-0.05 * U, 0.25 * U, 0.13 * U, 0.07 * U, 0.03 * U).fill({ color: WANDERER.boots });
    }

    // Arms: pivot at the shoulder. The back arm is a shade darker.
    for (const [arm, shade] of [
      [this.backArm, WANDERER.coatShade],
      [this.frontArm, WANDERER.coat],
    ] as const) {
      arm.position.set(SHOULDER.x * U, SHOULDER.y * U);
      arm.roundRect(-0.035 * U, -0.02 * U, 0.07 * U, ARM_LEN * U, 0.03 * U).fill({ color: shade }).stroke(line);
      arm.circle(0, ARM_LEN * U, 0.036 * U).fill({ color: WANDERER.skin }).stroke(line);
    }

    // Backpack, behind the torso.
    this.backpack
      .roundRect(-0.28 * U, -0.66 * U, 0.16 * U, 0.3 * U, 0.05 * U)
      .fill({ color: WANDERER.backpack })
      .stroke(line)
      .roundRect(-0.29 * U, -0.68 * U, 0.18 * U, 0.1 * U, 0.04 * U)
      .fill({ color: WANDERER.backpackFlap })
      .stroke(line);

    // Torso with a strap across the chest.
    this.torso.roundRect(-0.13 * U, -0.7 * U, 0.26 * U, 0.4 * U, 0.07 * U).fill({ color: WANDERER.coat }).stroke(line);
    this.torso.moveTo(-0.1 * U, -0.68 * U).lineTo(0.06 * U, -0.44 * U).stroke({ ...line, width: STROKE * 1.6 });

    // Head with a round hat and a single dot of an eye, in profile.
    const head = this.head;
    head.position.set(0.02 * U, -0.84 * U);
    head.circle(0, 0, 0.13 * U).fill({ color: WANDERER.skin }).stroke(line);
    head.circle(0.07 * U, -0.01 * U, 0.014 * U).fill({ color: ink });
    head.ellipse(0, -0.085 * U, 0.22 * U, 0.038 * U).fill({ color: WANDERER.hat }).stroke(line);
    head.roundRect(-0.11 * U, -0.19 * U, 0.22 * U, 0.12 * U, 0.05 * U).fill({ color: WANDERER.hat }).stroke(line);
    head.rect(-0.11 * U, -0.115 * U, 0.22 * U, 0.025 * U).fill({ color: WANDERER.hatBand });

    // Scarf: a band at the neck and a tail that streams behind.
    this.scarf.roundRect(-0.15 * U, -0.75 * U, 0.3 * U, 0.065 * U, 0.03 * U).fill({ color: WANDERER.scarf }).stroke(line);
    this.scarfTail.position.set(-0.12 * U, -0.71 * U);
    this.scarfTail
      .moveTo(0, -0.02 * U)
      .lineTo(-0.2 * U, 0.03 * U)
      .lineTo(-0.22 * U, 0.1 * U)
      .lineTo(-0.02 * U, 0.05 * U)
      .closePath()
      .fill({ color: WANDERER.scarf })
      .stroke(line);

    // Umbrella: origin at the hand, handle up to the canopy.
    const u = this.umbrella;
    const cx = -0.04 * U;
    const top = -0.34 * U;
    const r = 0.4 * U;
    u.moveTo(0, 0).lineTo(cx, top).stroke({ ...line, width: STROKE * 1.5 });
    u.moveTo(cx - r, top).arc(cx, top, r, Math.PI, 0).lineTo(cx - r, top).fill({ color: WANDERER.umbrella }).stroke(line);
    for (const a of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]) {
      u.moveTo(cx, top).lineTo(cx + Math.cos(a) * r, top + Math.sin(a) * r).stroke({ color: ink, width: STROKE * 0.8, alpha: 0.35 });
    }
    u.moveTo(cx, top - r).lineTo(cx, top - r - 0.04 * U).stroke(line);

    // Lantern: origin at the hand, hanging below it. The glass is translucent
    // so the untinted flame behind it shows through at night.
    const l = this.lantern;
    l.moveTo(0, 0).lineTo(0, 0.03 * U).stroke(line);
    l.rect(-0.05 * U, 0.03 * U, 0.1 * U, 0.022 * U).fill({ color: ink });
    l.roundRect(-0.042 * U, 0.05 * U, 0.084 * U, 0.11 * U, 0.015 * U).fill({ color: WANDERER.lanternGlass, alpha: 0.35 }).stroke(line);
    l.rect(-0.05 * U, 0.16 * U, 0.1 * U, 0.02 * U).fill({ color: ink });
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

/** Where the hand ends up for an arm rotation, in figure units. */
function handOf(rotation: number): { x: number; y: number } {
  return {
    x: SHOULDER.x - ARM_LEN * Math.sin(rotation),
    y: SHOULDER.y + ARM_LEN * Math.cos(rotation),
  };
}
