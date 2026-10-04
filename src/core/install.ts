/**
 * When to suggest adding Wanderling to the home screen. Pure, so it can be
 * tested; the DOM part lives in ui/install.ts.
 *
 * iOS Safari has no install prompt, so the hint has to explain the Share
 * menu. It is shown once the person has come back at least once (or stayed
 * a while), never inside an installed app, and not again once dismissed.
 */

export interface InstallContext {
  userAgent: string;
  /** True when running from the home screen (standalone display mode). */
  standalone: boolean;
  /** How many times the app has been opened, this one included. */
  visits: number;
  /** Seconds spent in this visit so far. */
  secondsHere: number;
  dismissed: boolean;
}

export type InstallHint = 'none' | 'ios' | 'prompt';

export function isIosSafari(ua: string): boolean {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return ios && !otherBrowser;
}

/**
 * 'ios' shows the Share-menu explanation; 'prompt' means the browser offered
 * its own install prompt (passed in by the caller as `canPrompt`).
 */
export function installHint(ctx: InstallContext, canPrompt = false): InstallHint {
  if (ctx.standalone || ctx.dismissed) return 'none';
  const settled = ctx.visits >= 2 || ctx.secondsHere >= 45;
  if (!settled) return 'none';
  if (canPrompt) return 'prompt';
  if (isIosSafari(ctx.userAgent)) return 'ios';
  return 'none';
}
