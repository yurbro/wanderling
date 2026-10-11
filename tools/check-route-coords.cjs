#!/usr/bin/env node
/*
 * Checks a route data file's coordinates against Open-Meteo's geocoder and
 * reports every place more than 5 km from the geocoder's first hit.
 *
 *   node tools/check-route-coords.cjs docs/routes/north-light-v1.json
 *
 * Needs network access to geocoding-api.open-meteo.com. Places the geocoder
 * does not know (a crossing at sea, a cliff) are listed as "not found" and
 * are for a person to judge.
 */
const fs = require('fs');

const file = process.argv[2] || 'docs/routes/north-light-v1.json';
const LIMIT_KM = Number(process.argv[3] || 5);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function lookup(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${name}`);
  const json = await res.json();
  return Array.isArray(json.results) ? json.results : [];
}

(async () => {
  let bad = 0;
  for (const p of data.places) {
    const name = typeof p.name === 'string' ? p.name : p.name.en;
    let results;
    try {
      results = await lookup(name);
    } catch (e) {
      console.log(`?  ${name}: ${e.message}`);
      continue;
    }
    // Prefer a hit in the same country; else the first.
    const hit = results.find((r) => r.country === p.country) || results[0];
    if (!hit) {
      console.log(`?  ${name}: not found`);
      continue;
    }
    const km = haversineKm({ lat: p.lat, lon: p.lon }, { lat: hit.latitude, lon: hit.longitude });
    const flag = km > LIMIT_KM ? '!!' : 'ok';
    if (km > LIMIT_KM) bad++;
    console.log(`${flag} ${name}: ${km.toFixed(1)} km from ${hit.name}, ${hit.country} (${hit.latitude.toFixed(2)}, ${hit.longitude.toFixed(2)})`);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\n${bad} place(s) more than ${LIMIT_KM} km off.`);
})();
