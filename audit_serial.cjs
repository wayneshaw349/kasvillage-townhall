// audit_serial.cjs — what reads a serial, and does anything block on it?
// Run: node audit_serial.cjs
const fs = require('fs');
const path = require('path');

const SRC_EXT = /\.(tsx?|rs)$/;
const out = [];

function walk(d, acc = []) {
  let ents;
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'build_shamir') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, acc); continue; }
    if (SRC_EXT.test(e.name) && !/\.bak/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk('.');
out.push(`scanned ${files.length} source files`);

// ---- 1. every serial mention, with a blocking verdict -----------------------
out.push('', '='.repeat(70), '== ALL SERIAL REFERENCES', '='.repeat(70));

const BLOCKING = [
  /if\s*\(\s*!\s*\w*[Ss]erial/,          // if (!serialHash)
  /throw .*[Ss]erial/,
  /[Ss]erial.*required/i,
  /required.*[Ss]erial/i,
  /return\s*{\s*success:\s*false[^}]*[Ss]erial/i,
];

let hits = 0, blockers = 0;
for (const f of files) {
  let L;
  try { L = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch { continue; }
  L.forEach((l, n) => {
    if (!/serial/i.test(l)) return;
    hits++;
    const isBlock = BLOCKING.some(re => re.test(l));
    if (isBlock) blockers++;
    // is it guarded as optional?
    const optional = /if\s*\(\s*\w*[Ss]erial\w*\s*\)/.test(l) || /\?\?|\|\|/.test(l);
    const flag = isBlock ? ' <<< BLOCKING?' : (optional ? '   [optional]' : '');
    out.push(`${path.basename(f)}:${n + 1}: ${l.trim()}${flag}`);
  });
}
if (!hits) out.push('!! no serial references anywhere');

// ---- 2. what the attestation hash is actually built from --------------------
out.push('', '='.repeat(70), '== FINGERPRINT COMPONENTS', '='.repeat(70));
for (const f of files.filter(x => /attestation|device_verif/i.test(x))) {
  const L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const i = L.findIndex(l => /const components\s*=\s*\[/.test(l));
  if (i < 0) continue;
  out.push(`--- ${path.basename(f)} ---`);
  for (let n = i; n < Math.min(L.length, i + 14); n++) {
    out.push(String(n + 1).padStart(5) + ' | ' + L[n]);
    if (L[n].includes('];')) break;
  }
}

// ---- 3. is the anchor hardware-derived or random? --------------------------
out.push('', '='.repeat(70), '== ANCHOR SOURCE (random UUID = not hardware-bound)', '='.repeat(70));
for (const f of files) {
  let L;
  try { L = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch { continue; }
  L.forEach((l, n) => {
    if (/randomUUID|getRandomBytes|DEVICE_ANCHOR|getOrCreateAnchor|deviceAnchor/i.test(l))
      out.push(`${path.basename(f)}:${n + 1}: ${l.trim()}`);
  });
}

// ---- 4. server-side: does TownHall demand it? ------------------------------
out.push('', '='.repeat(70), '== RUST / TOWNHALL SIDE', '='.repeat(70));
let rs = 0;
for (const f of files.filter(x => x.endsWith('.rs'))) {
  const L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  L.forEach((l, n) => {
    if (/serial|device_hash|attestation/i.test(l)) { out.push(`${path.basename(f)}:${n + 1}: ${l.trim()}`); rs++; }
  });
}
if (!rs) out.push('(no rust files matched)');

out.push('', '='.repeat(70));
out.push(`VERDICT: ${hits} serial references, ${blockers} flagged as possibly blocking`);
out.push('='.repeat(70));

const text = out.join('\n');
fs.writeFileSync('audit_serial.txt', text, 'utf8');
console.log(text);
console.log('\n[written] audit_serial.txt');
