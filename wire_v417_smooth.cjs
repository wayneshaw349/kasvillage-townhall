// wire_v417_smooth.cjs - KasCity v417: pieces glide instead of teleporting after a sync jump; sync housekeeping
//   lines (RESYNC, drifted, dropped roll...) leave the on-screen log - they stay in COPY LOG.
//   node wire_v417_smooth.cjs   (project folder; safe to run twice; edits the v417 files in place, backups *.bak_smooth)
const fs = require('fs');
const MARK = '__KV_V417_QUIET';
const HUNKS = [
  ["    var dx = tx - x, dz = tz - z;\n", "    /*KV_GLIDE*/ var Gl = (window.__kvGlide = window.__kvGlide || {}), G = Gl[p] || (Gl[p] = { x: tx, z: tz });\n    if (Math.hypot(tx - G.x, tz - G.z) > 3 && !G.a) G.a = { x: G.x, z: G.z, t0: Date.now() };   // a jump (resync, card move): slide, never teleport\n    if (G.a){ var gk = Math.min(1, (Date.now() - G.a.t0) / 450); gk = gk * (2 - gk); tx = G.a.x + (tx - G.a.x) * gk; tz = G.a.z + (tz - G.a.z) * gk; if (gk >= 1) G.a = null; }\n    G.x = tx; G.z = tz;\n    var dx = tx - x, dz = tz - z;\n"],
  ['  setInterval(function(){ try { placeAll(); } catch(e){} }, 120);', '  setInterval(function(){ try { placeAll(); } catch(e){} }, 50);'],
  ['  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);\n', '  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);\n' + "\n  // ---- __KV_V417_QUIET: sync housekeeping stays in COPY LOG, off the player's screen ----\n  (function(){\n    var TECH = /RESYNC|resyncing|drifted|dropped P\\d|self-heal|half-open|holding your roll|stall-scan|failsafe|relay divergence|reads pinned|fan-out|corrected dice|turnlock|blocked an outside|blocked P\\d|cleared a stale|stuck modal|orderer|append: adopted|adopted (snapshot|relay)|engine (on|lagging|untouched)|mid-fuse|lag breaker|chain expects|the chain is on|clock re-anchored|relay (refused|nodes|:)|node discovery|chain polling|final bell \u2014 the chain|state updated from|update after move|adopted \\w+ P\\d @|armed —|observe mode|systems ok|^offers: |KV_RELAY|composer removed|retired —|derived from the chain|posts to the chain|play by play ready/i;\n    function scrub(n){\n      try { if (n && n.nodeType === 1 && n.tagName === \"DIV\" && /border-left:\\s*4px solid/.test(n.getAttribute(\"style\") || \"\") && TECH.test(n.textContent || \"\")) n.style.display = \"none\"; } catch(e){}\n    }\n    try {\n      new MutationObserver(function(ms){ ms.forEach(function(m){ for (var i = 0; i < m.addedNodes.length; i++) scrub(m.addedNodes[i]); }); })\n        .observe(document.body, { childList: true, subtree: true });\n    } catch(e){}\n  })();\n"],
];
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html', 'tools/v417/v417_runtime.js'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 60)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_smooth', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
