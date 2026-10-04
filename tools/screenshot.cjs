// Visual self-check: screenshots of the scene at several times of day.
// Run with: NODE_PATH=/opt/npm-tools/node_modules node tools/screenshot.cjs [baseUrl]
// Expects `npm run preview` (or any server) to be serving the built site.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:4173/wanderling/';
const times = (process.env.TIMES || '06:40,09:30,13:00,18:20,19:05,22:30').split(',');
const outDir = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
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
  for (const t of times) {
    const url = `${base}?t=${encodeURIComponent(t)}${process.env.EXTRA || ''}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas.scene');
    await page.waitForTimeout(700);
    const file = path.join(outDir, `scene-${t.replace(':', '')}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
