// kascity_visual_v22.cjs
// Reads kascity_v21.json + scene_engine.html -> writes kascity_v22.json + showcase_kascity22.html
// Changes: portraits 2x (spriteSize 2.8); p3/p4 moved from back corners (off-camera) to visible side
// positions above p1/p2; every seat gets a CREDIT line stat (seeded 500 at boot) shown under cash;
// four Kaspa wallet <input> boxes injected into the showcase (in-memory only: window.KV_WALLETS,
// no localStorage), one under each player corner.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v21.json')) die('kascity_v21.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v21.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);

// ---------- 1. portraits: x2 + visible positions ----------
const pos = { 1: null, 2: null, 3: [-14, 2.2, 10.2], 4: [14, 2.2, 10.2] }; // p3 above p2 side, p4 above p1 side
let portN = 0;
for (let p = 1; p <= 4; p++) {
  const n = byId('portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing');
  n.spriteSize = 2.8;
  if (pos[p]) n.transform.pos = pos[p];
  portN++;
}
if (portN !== 4) die('portraits ' + portN);

// ---------- 2. credit line: seat stat + HUD rows ----------
const director = byId('director');
if (!director) die('director missing');
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (let p = 1; p <= 4; p++) ins.push({ after: 0.1, do: { action: 'setSeatStat', args: [p, 'credit', 500] } });
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const hud = byId('hud');
if (!hud || !Array.isArray(hud.children)) die('hud missing');
const rows = { 1: ['topLeft', 10, 56], 2: ['topRight', -100, 56], 3: ['topLeft', 10, 120], 4: ['topRight', -100, 120] };
for (let p = 1; p <= 4; p++) {
  if (hud.children.some(c => c.id === 'cr' + p)) die('cr' + p + ' exists');
  const [a, x, y] = rows[p];
  hud.children.push(
    { id: 'crl' + p, type: 'Label', anchor: a, pos: [x, y], size: 10, text: 'CREDIT', color: '#b8c4b0' },
    { id: 'cr' + p, type: 'Label', anchor: a, pos: [x + 52, y], size: 12, text: '', bind: 'seats.' + p + '.credit', color: '#9cd87c', weight: 700, shadow: '#241c12' }
  );
}

// ---------- write json ----------
const v22str = JSON.stringify(j);
fs.writeFileSync('kascity_v22.json', v22str);

// ---------- engine patches (embedded only): speech + label bind + wallet inputs ----------
const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
engine = engine.split(fnAnchor).join(fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try { var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel(); window.speechSynthesis.speak(_u); } catch (e) {}\n' +
  '  }\n');
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
engine = engine.split(bindAnchor).join('if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ' + bindAnchor);

const walletJs = [
  '// ---- kaspa wallet inputs (in-memory only) ----',
  'window.KV_WALLETS = window.KV_WALLETS || {};',
  '(function(){',
  '  var spots = { 1: "left:8px;top:150px;", 2: "right:8px;top:150px;", 3: "left:8px;top:214px;", 4: "right:8px;top:214px;" };',
  '  for (var p = 1; p <= 4; p++) (function(p){',
  '    var el = document.createElement("input");',
  '    el.id = "kvw" + p; el.placeholder = "P" + p + " kaspa wallet";',
  '    el.style.cssText = "position:fixed;" + spots[p] + "width:150px;z-index:50;background:#1a1410;color:#f4e4c1;" +',
  '      "border:1px solid #5a4a3a;border-radius:4px;padding:3px 6px;font:11px monospace;opacity:0.85;";',
  '    el.addEventListener("input", function(){ window.KV_WALLETS[p] = el.value.trim(); });',
  '    document.body.appendChild(el);',
  '  })(p);',
  '})();'
].join('\n');

const inject = [
  '', '// ---- injected kascity v22 showcase ----',
  walletJs,
  'try { loadScene(' + JSON.stringify(v22str) + '); }',
  "catch (e) { console.error('kascity22 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity22.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS portraits 2.8, p3/p4 moved to visible sides');
console.log('PASS credit 500 seeded per seat + HUD CREDIT rows');
console.log('PASS kaspa wallet inputs x4 (in-memory, window.KV_WALLETS)');
console.log('OK kascity_v22.json + showcase_kascity22.html');
