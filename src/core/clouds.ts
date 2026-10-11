import { smoothstep } from './color';

/**
 * How far a cloud fades where it would sit under the HUD's clock and lines
 * in the top left corner, so the time stays readable. 1 leaves the cloud as
 * it is; the floor is what is left of it right under the text.
 * Positions are fractions of the screen's width and height.
 */
export const HUD_CLOUD_FLOOR = 0.3;

export function hudCloudFade(cx: number, cy: number): number {
  const inX = 1 - smoothstep(0.52, 0.74, cx);
  const inY = 1 - smoothstep(0.24, 0.34, cy);
  return 1 - (1 - HUD_CLOUD_FLOOR) * inX * inY;
}
