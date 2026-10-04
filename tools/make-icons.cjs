// Renders the app icon set from a small inline SVG.
// Run with: NODE_PATH=/opt/npm-tools/node_modules node tools/make-icons.cjs
// (sharp is only needed at authoring time, so it is not a project dependency.)
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4C5590"/>
      <stop offset="0.55" stop-color="#9A86A4"/>
      <stop offset="1" stop-color="#E6AA8E"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="352" cy="176" r="46" fill="#F3EAD2"/>
  <circle cx="110" cy="96" r="3.5" fill="#F6F1E3" opacity="0.9"/>
  <circle cx="186" cy="62" r="2.5" fill="#F6F1E3" opacity="0.8"/>
  <circle cx="72" cy="170" r="2.5" fill="#F6F1E3" opacity="0.7"/>
  <circle cx="246" cy="118" r="2.5" fill="#F6F1E3" opacity="0.6"/>
  <path d="M0 356 C 80 316, 140 338, 210 322 S 352 282, 512 340 L512 512 L0 512 Z" fill="#6F8A86"/>
  <path d="M0 398 C 110 372, 210 404, 310 386 S 440 372, 512 396 L512 512 L0 512 Z" fill="#4F6A5F"/>
  <path d="M0 448 C 150 430, 300 456, 512 440 L512 512 L0 512 Z" fill="#3B5249"/>
</svg>`;

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

const targets = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

(async () => {
  for (const [name, size] of targets) {
    await sharp(Buffer.from(svg(size))).png().toFile(path.join(out, name));
    console.log('wrote', name);
  }
})();
