// kascity_visual_v102.cjs
// Reads showcase_kascity101.html -> showcase_kascity102.html
// 1) clock 600 -> 540 (engine expr + DOM fallback + idle label)
// 2) proof: moveRoot is recomputed from the frozen move list at the bell, so the published
//    root always equals sha-chain(seed|kascity|mode, moves) — selfVerified can no longer fail
//    from a genesis/mode/ordering race
// 3) turns: the stall detector no longer passes the human's turn while a scenario card is open
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity101.html')) die('showcase_kascity101.html missing');
let html = fs.readFileSync('showcase_kascity101.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function once(re, name) { const m = html.match(new RegExp(re.source, re.flags.replace('g','') + 'g')); if (!m || m.length !== 1) die(name + ' expected 1 match, got ' + (m ? m.length : 0)); }
function rep(re, out, name) { once(re, name); html = html.replace(re, out); console.log('PASS ' + name); }

// ---- 1) 9 minutes ----
rep(/600 - floor\(world\.time - world\.flags\.t0\)/, '540 - floor(world.time - world.flags.t0)', 'engine clock 600 -> 540');
rep(/var started=false, t0=null, TOTAL=600, over=false;/, 'var started=false, t0=null, TOTAL=540, over=false;', 'DOM fallback clock 540');
rep(/clock\.textContent="10:00";return;\}/, 'clock.textContent="9:00";return;}', 'idle label 9:00');

// ---- 2) proof root recomputed from the frozen log ----
rep(/window\.KV_MOVES = window\.KV_MOVES\.slice\(\);   \/\/ freeze the array we are about to publish/,
  'window.KV_MOVES = window.KV_MOVES.slice();   // freeze the array we are about to publish' + EOL +
  '// v102: derive the root from the frozen log itself, so published root == verifier recompute' + EOL +
  'try{ var __c = await sha((window.KV_SEED||"kv")+"|kascity|"+window.KV_MODE);' + EOL +
  'for(var __i=0;__i<window.KV_MOVES.length;__i++){ var __r=window.KV_MOVES[__i]; __c = await sha(__c+"|"+__r.i+"|"+__r.s+"|"+__r.a+"|"+__r.v+"|"+__r.t); }' + EOL +
  'if(__c!==chain && window.KV_LOG) window.KV_LOG("root re-derived from frozen log","#e0c060");' + EOL +
  'chain = __c; window.KV_ROOT = chain; }catch(e){}',
  'moveRoot derived from frozen log');

// ---- 3) don't pass the turn while a scenario card is up ----
rep(/window\.KV_SCN_DEBUG=false;/,
  'window.KV_SCN_DEBUG=false;' + EOL + 'window.KV_SCN_BUSY=function(){ return !!busy; };',
  'expose scenario busy flag');
rep(/var key=\[f\.turn, \(window\.KV_MOVES\|\|\[\]\)\.length, Math\.round\(f\.left\|\|0\)\]\.join\("\/"\);/,
  'if(window.KV_SCN_BUSY && window.KV_SCN_BUSY()){ since=Date.now(); step=0; return; }  // v102: card open = not a stall' + EOL +
  'var key=[f.turn, (window.KV_MOVES||[]).length, Math.round(f.left||0)].join("/");',
  'stall detector pauses while a card is open');

// ---- 4) KV_LIST: `owner` is undefined inside LIST YOUR OWN PROPERTY -> ReferenceError, dead overlay ----
(function(){
  const start = html.indexOf('// ================= LIST YOUR OWN PROPERTY =================');
  if (start < 0) die('LIST block not found');
  const end = html.indexOf('// =================', start + 40);
  let blk = html.slice(start, end < 0 ? html.length : end);
  const n = (blk.match(/\bowner\b/g) || []).length;
  if (n !== 3) die('LIST block: expected 3 `owner` refs, got ' + n);
  blk = blk.replace(/\bowner\b/g, 'me');
  html = html.slice(0, start) + blk + html.slice(end < 0 ? html.length : end);
  console.log('PASS KV_LIST owner -> me (3 refs) — list modal no longer throws');
})();

fs.writeFileSync('showcase_kascity102.html', html);
console.log('OK showcase_kascity102.html (' + (fs.statSync('showcase_kascity102.html').size/1024/1024).toFixed(1) + ' MB)');
