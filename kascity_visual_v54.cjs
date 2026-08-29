// kascity_visual_v54.cjs
// Reads kascity_v53.json (or v52/v51) + showcase_kascity53.html -> v54 outputs
// BUG: the engine's expression parser has no ternary operator, so every bot buy condition written as
//   A && (left > 200 ? (hz < 34 || price < 120) : (cash >= X && hz < 30))
// failed to parse — "bad char in expression: ?" — meaning bots never evaluated a purchase at all.
// Rewritten as pure boolean logic:
//   A && ( (left > 200 && (hz < 34 || price < 120)) || (left <= 200 && cash >= X && hz < 30) )
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const jsonIn = ['kascity_v53.json','kascity_v52.json','kascity_v51.json','kascity_v50.json'].find(f => fs.existsSync(f));
if (!jsonIn) die('no kascity_v5x.json found');
const htmlIn = 'showcase_kascity53.html';
if (!fs.existsSync(htmlIn)) die(htmlIn + ' missing');
console.log('source json: ' + jsonIn);

const j = JSON.parse(fs.readFileSync(jsonIn, 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// paren-balanced ternary rewriter (regex can't handle the nested parens in the else-branch)
function rewriteTernaries(c) {
  let guard = 0;
  while (c.indexOf('?') >= 0 && guard++ < 8) {
    const q = c.indexOf('?');
    let depth = 0, start = -1;
    for (let i = q - 1; i >= 0; i--) {
      const ch = c[i];
      if (ch === ')') depth++;
      else if (ch === '(') { if (depth === 0) { start = i; break; } depth--; }
    }
    if (start < 0) break;
    depth = 0; let end = -1;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) break;
    const inner = c.slice(start + 1, end);
    depth = 0; let qi = -1, ci = -1;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '?' && depth === 0 && qi < 0) qi = i;
      else if (ch === ':' && depth === 0 && qi >= 0 && ci < 0) ci = i;
    }
    if (qi < 0 || ci < 0) break;
    const test = inner.slice(0, qi).trim();
    const a = inner.slice(qi + 1, ci).trim();
    const b = inner.slice(ci + 1).trim();
    const m = /^\s*(.+?)\s*(>=|<=|>|<|==|!=)\s*(.+?)\s*$/.exec(test);
    const inv = { '>': '<=', '<': '>=', '>=': '<', '<=': '>', '==': '!=', '!=': '==' };
    const neg = m ? (m[1] + ' ' + inv[m[2]] + ' ' + m[3]) : ('!(' + test + ')');
    c = c.slice(0, start) + '((' + test + ' && ' + a + ') || (' + neg + ' && ' + b + '))' + c.slice(end + 1);
  }
  return c;
}

let fixed = 0, remaining = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.cond === 'string' && o.cond.indexOf('?') >= 0) {
    const c = rewriteTernaries(o.cond);
    if (c.indexOf('?') >= 0) remaining++;
    else { o.cond = c; fixed++; }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);

if (fixed < 16) die('ternary conditions rewritten ' + fixed + ' (<16)');
if (remaining) die(remaining + ' conditions still contain "?" — pattern did not match, aborting');

// verify none survive anywhere in the scene
const scan = JSON.stringify(j);
const stray = (scan.match(/"cond":"[^"]*\?[^"]*"/g) || []).length;
if (stray) die(stray + ' stray ternary conds remain');

const v54str = JSON.stringify(j);
fs.writeFileSync('kascity_v54.json', v54str);

// swap the embedded scene in the showcase
let html = fs.readFileSync(htmlIn, 'utf8');
const oldJson = fs.readFileSync(jsonIn, 'utf8');
const occ = html.split(JSON.stringify(oldJson)).length - 1;
if (occ !== 1) die('embedded scene JSON found ' + occ + ' times (need 1) — is ' + htmlIn + ' built from ' + jsonIn + '?');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v54str));

fs.writeFileSync('showcase_kascity54.html', html);
console.log('PASS ' + fixed + ' ternary conditions rewritten as boolean logic');
console.log('PASS no "?" remains in any condition — bot buy rules will now parse');
console.log('OK kascity_v54.json + showcase_kascity54.html (' + (fs.statSync('showcase_kascity54.html').size/1024/1024).toFixed(1) + ' MB)');
