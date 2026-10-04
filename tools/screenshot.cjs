// Visual self-check: screenshots of the scene at several times of day.
// Run with: NODE_PATH=<dir with playwright> node tools/screenshot.cjs [baseUrl]
// Expects `npm run preview` (or any server) to be serving the built site.
//
// Environment knobs:
//   TIMES=06:40,13:00     times of day to capture (default: six moments)
//   WEATHERS=clear,rain   weather conditions to force via ?weather= (default: none)
//   EXTRA=&lat=..&lon=..  appended to every URL
//   CHROMIUM_PATH=/path   use a preinstalled Chromium instead of playwright's own
//   TZ_ID=Europe/London   browser time zone
//   WAIT_MS=900           how long to let the scene run before each shot
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:4173/wanderling/';
const times = (process.env.TIMES || '06:40,09:30,13:00,18:20,19:05,22:30').split(',');
const weathers = (process.env.WEATHERS || '').split(',').filter(Boolean);
const outDir = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: process.env.TZ_ID || 'Europe/London',
    locale: 'en-GB',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.type(), m.text());
  });
  const shots = [];
  for (const t of times) {
    if (weathers.length === 0) shots.push({ t, w: '' });
    for (const w of weathers) shots.push({ t, w });
  }
  for (const { t, w } of shots) {
    const wq = w ? `&weather=${encodeURIComponent(w)}` : '';
    const url = `${base}?t=${encodeURIComponent(t)}${wq}${process.env.EXTRA || ''}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas.scene');
    await page.waitForTimeout(Number(process.env.WAIT_MS || 900));
    const file = path.join(outDir, `scene-${t.replace(':', '')}${w ? '-' + w : ''}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
