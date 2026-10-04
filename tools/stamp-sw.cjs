// Stamps a build version into dist/sw.js so every deploy gets its own cache.
// Runs after `vite build` (see package.json). Uses the git commit when
// available, otherwise the time.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const file = path.join(__dirname, '..', 'dist', 'sw.js');
let version;
try {
  version = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  version = '';
}
if (!version) version = String(Date.now());
version += '-' + Date.now().toString(36);

const src = fs.readFileSync(file, 'utf8');
if (!src.includes('__VERSION__')) {
  console.error('stamp-sw: placeholder not found in', file);
  process.exit(1);
}
fs.writeFileSync(file, src.split('__VERSION__').join(version));
console.log('stamp-sw: dist/sw.js version', version);
