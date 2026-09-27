// kascity_visual_v74.cjs
// Reads kascity_v73.json -> kascity_v74.json (+ rebuilds showcase_kascity74.html)
//
// COMPRESSION PASS. Nothing about gameplay changes; this removes mechanical duplication and reports
// the real on-chain cost.
//   1. DEDUPE: v63 matched 106 "offer tiles" when only 28 exist, producing identical branches many
//      times over. Any branch whose serialised form already appeared in the same selector is dropped —
//      an exact duplicate can never be reached, since the first copy always wins.
//   2. DEAD CONDITIONS: branches gated on flags that are never written are unreachable; reported.
//   3. WHITESPACE / NUMBER NORMALISATION in expression strings.
//   4. GZIP MEASUREMENT against the ~100 KB Kaspa payload budget, with a tx-count estimate.
const fs = require('fs');
const zlib = require('zlib');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v73.json')) die('kascity_v73.json missing');
if (!fs.existsSync('showcase_kascity73.html')) die('showcase_kascity73.html missing');

const raw = fs.readFileSync('kascity_v73.json', 'utf8');
const j = JSON.parse(raw);
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

const before = { bytes: raw.length, gz: zlib.gzipSync(raw, { level: 9 }).length };

// ---------- 1. dedupe within every selector ----------
let dropped = 0, selectorsTouched = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const seen = new Set();
    const kept = [];
    for (const br of o.selector) {
      const key = JSON.stringify(br);
      if (seen.has(key)) { dropped++; continue; }
      seen.add(key);
      kept.push(br);
    }
    if (kept.length !== o.selector.length) selectorsTouched++;
    o.selector = kept;
  }
  if (Array.isArray(o.sequence)) {
    const seen = new Set();
    const kept = [];
    for (const st of o.sequence) {
      const key = JSON.stringify(st);
      // only dedupe pure state writes; actions can legitimately repeat
      if (st && st.do && (st.do.action === 'setState' || st.do.action === 'setFlagExpr')) {
        if (seen.has(key)) { dropped++; continue; }
        seen.add(key);
      }
      kept.push(st);
    }
    o.sequence = kept;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);

// ---------- 2. normalise expression strings ----------
let normed = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.cond === 'string') {
    const n = o.cond.replace(/\s+/g, ' ').trim();
    if (n !== o.cond) { o.cond = n; normed++; }
  }
  if (o.do && o.do.action === 'setFlagExpr' && o.do.args && typeof o.do.args[1] === 'string') {
    const n = o.do.args[1].replace(/\s+/g, ' ').trim();
    if (n !== o.do.args[1]) { o.do.args[1] = n; normed++; }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);

// ---------- 3. reachability report ----------
const s = JSON.stringify(j);
const written = new Set();
(function walk3(o) {
  if (!o || typeof o !== 'object') return;
  if (o.do && (o.do.action === 'setState' || o.do.action === 'setFlagExpr') && o.do.args)
    written.add(String(o.do.args[0]));
  if (o.do && o.do.action === 'setSeatStat' && o.do.args) written.add('seat:' + o.do.args[1]);
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk3(v);
})(director);
const readFlags = new Set();
(s.match(/world\.flags\.([A-Za-z_][A-Za-z0-9_]*)/g) || []).forEach(m => readFlags.add(m.split('.')[2]));
const orphanReads = [...readFlags].filter(f => !written.has(f));

// ---------- write ----------
const out = JSON.stringify(j);
const after = { bytes: out.length, gz: zlib.gzipSync(out, { level: 9 }).length };
fs.writeFileSync('kascity_v74.json', out);

// rebuild the showcase around the compacted scene
let html = fs.readFileSync('showcase_kascity73.html', 'utf8');
if (html.split(JSON.stringify(raw)).length - 1 !== 1) die('embedded v73 JSON not found exactly once');
html = html.split(JSON.stringify(raw)).join(JSON.stringify(out));
fs.writeFileSync('showcase_kascity74.html', html);

function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }
const CAP = 100000;
console.log('PASS ' + dropped + ' duplicate branches/steps removed across ' + selectorsTouched + ' selectors');
console.log('PASS ' + normed + ' expression strings normalised');
if (orphanReads.length) console.log('NOTE flags read but never written: ' + orphanReads.slice(0, 8).join(', ') + (orphanReads.length > 8 ? ' …' : ''));
console.log('');
console.log('  raw      ' + kb(before.bytes) + '  ->  ' + kb(after.bytes) +
            '   (' + (100 - after.bytes / before.bytes * 100).toFixed(1) + '% smaller)');
console.log('  gzipped  ' + kb(before.gz) + '  ->  ' + kb(after.gz));
console.log('  kaspa payload cap ~' + kb(CAP) + '  ->  ' + Math.ceil(after.gz / CAP) + ' tx gzipped, ' +
            Math.ceil(after.bytes / CAP) + ' tx raw');
console.log('');
console.log('OK kascity_v74.json + showcase_kascity74.html');
