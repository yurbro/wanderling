import { describe, expect, it } from 'vitest';
import { installHint, isIosSafari } from '../src/core/install';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';

const base = { userAgent: IOS_SAFARI, standalone: false, visits: 2, secondsHere: 5, dismissed: false };

describe('isIosSafari', () => {
  it('recognises Safari on iPhone and iPad, not other iOS browsers or Android', () => {
    expect(isIosSafari(IOS_SAFARI)).toBe(true);
    expect(isIosSafari(IPAD)).toBe(true);
    expect(isIosSafari(IOS_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID)).toBe(false);
  });
});

describe('installHint', () => {
  it('explains the Share menu on iOS Safari from the second visit', () => {
    expect(installHint(base)).toBe('ios');
    expect(installHint({ ...base, visits: 1 })).toBe('none');
    expect(installHint({ ...base, visits: 1, secondsHere: 60 })).toBe('ios');
  });

  it('stays quiet once installed or dismissed', () => {
    expect(installHint({ ...base, standalone: true })).toBe('none');
    expect(installHint({ ...base, dismissed: true })).toBe('none');
  });

  it('prefers the browser prompt where one exists', () => {
    expect(installHint({ ...base, userAgent: ANDROID })).toBe('none');
    expect(installHint({ ...base, userAgent: ANDROID }, true)).toBe('prompt');
    expect(installHint({ ...base, userAgent: ANDROID, visits: 1 }, true)).toBe('none');
  });
});
