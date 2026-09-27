// kascity_visual_v13.cjs
// Reads kascity_v12.json + scene_engine.html -> writes kascity_v13.json + showcase_kascity13.html
// Changes: portraits smaller + one per board corner + face colors (pink/blue/green/yellow),
// per-corner HUD cash (name + number + bar beside each portrait's corner),
// ka-ching coin layers on buy/rent/depot sounds, reggae skank+bass background loop via beat branches.
// Abort-on-mismatch; v12 files and scene_engine.html untouched on disk.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V12 = 'kascity_v12.json';
if (!fs.existsSync(V12)) die(V12 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V12, 'utf8'));
const RES = j.resources || die('resources missing');
const nodes = j.nodes;
const byId = id => nodes.find(n => n.id === id);

// ---------- 1. portraits: smaller, corner positions, colored faces ----------
const faceCol = { 1: '#f0a0c0', 2: '#7fb8d8', 3: '#8cd87c', 4: '#f0d860' }; // pink blue green yellow
const shade   = { 1: '#d97fa8', 2: '#5a98c0', 3: '#6ab85e', 4: '#d9bc48' };
const corners = { 1: [14, 2.2, 14], 2: [-14, 2.2, 14], 3: [-14, 2.2, -14], 4: [14, 2.2, -14] };
function portraitSprite(skin, nose, shirt) {
  const W = 20, H = 22, ink = '#241c12', hair = '#241c12', mouth = '#a83a2e';
  function face(open) {
    const r = [];
    r.push({ rect: [0, 0, W, 1], color: ink }, { rect: [0, H - 1, W, 1], color: ink });
    r.push({ rect: [0, 0, 1, H], color: ink }, { rect: [W - 1, 0, 1, H], color: ink });
    r.push({ rect: [1, 1, W - 2, 4], color: hair });
    r.push({ rect: [1, 5, W - 2, 11], color: skin });
    r.push({ rect: [3, 4, 3, 2], color: hair }, { rect: [W - 6, 4, 3, 2], color: hair });
    if (open) { r.push({ rect: [5, 9, 2, 2], color: ink }, { rect: [13, 9, 2, 2], color: ink }); }
    else { r.push({ rect: [5, 10, 2, 1], color: ink }, { rect: [13, 10, 2, 1], color: ink }); }
    r.push({ rect: [9, 11, 2, 2], color: nose });
    r.push({ rect: [7, 14, 6, 1], color: mouth });
    r.push({ rect: [1, 16, W - 2, 5], color: shirt });
    r.push({ rect: [8, 16, 4, 5], color: ink });
    return r;
  }
  return { w: W, h: H, frames: [face(true), face(false)] };
}
const pcol = { 1: '#d94f4f', 2: '#4f7fd9', 3: '#4fd98a', 4: '#d9c14f' };
let portN = 0;
for (let p = 1; p <= 4; p++) {
  const n = byId('portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing (run v12 first)');
  n.transform = n.transform || {};
  n.transform.pos = corners[p];
  n.transform.scale = [0.32, 0.32, 0.32];
  RES.sprites['pface' + p] = portraitSprite(faceCol[p], shade[p], pcol[p]);
  portN++;
}
if (portN !== 4) die('portraits ' + portN + ' != 4');

// ---------- 2. HUD cash to matching screen corners ----------
const hud = byId('hud');
if (!hud || !Array.isArray(hud.children)) die('hud missing');
const hasBL = engine.indexOf('bottomLeft') >= 0;
const hasBR = engine.indexOf('bottomRight') >= 0;
// corner map mirrors board corners as seen from the fixed camera: p1 bottom-right-ish, keep simple screen mapping
const lay = {
  1: { a: 'topLeft',                       s: [10, 8],    c: [10, 24],   b: [10, 40]  },
  2: { a: 'topRight',                      s: [-100, 8],  c: [-100, 24], b: [-100, 40] },
  3: { a: hasBL ? 'bottomLeft' : 'topLeft',  s: hasBL ? [10, -56] : [10, 64],   c: hasBL ? [10, -40] : [10, 80],   b: hasBL ? [10, -24] : [10, 96]  },
  4: { a: hasBR ? 'bottomRight' : 'topRight', s: hasBR ? [-100, -56] : [-100, 64], c: hasBR ? [-100, -40] : [-100, 80], b: hasBR ? [-100, -24] : [-100, 96] }
};
let hudN = 0;
for (let p = 1; p <= 4; p++) {
  const s = hud.children.find(c => c.id === 's' + p);
  const c = hud.children.find(c => c.id === 'c' + p);
  const b = hud.children.find(c => c.id === 'b' + p);
  if (!s || !c || !b) die('hud s/c/b' + p + ' missing');
  s.anchor = lay[p].a; s.pos = lay[p].s;
  c.anchor = lay[p].a; c.pos = lay[p].c; c.size = 14;
  b.anchor = lay[p].a; b.pos = lay[p].b;
  hudN++;
}
if (hudN !== 4) die('hud corners ' + hudN + ' != 4');

// ---------- 3. sounds: ka-ching layers + reggae kit ----------
const snd = RES.sounds || die('resources.sounds missing');
function toLayers(def) { return def.layers ? def.layers : [Object.assign({}, def)]; }
const ching = [
  { type: 'tone', wave: 'sine', freq: 1319, sweep: 60, dur: 0.09, vol: 0.22 },
  { type: 'tone', wave: 'sine', freq: 1760, sweep: 40, dur: 0.14, vol: 0.18 }
];
for (const key of ['buy', 'rent', 'depot']) {
  if (!snd[key]) die('sound "' + key + '" missing');
  const L = toLayers(snd[key]).concat(ching);
  if (L.length > 6) die('sound "' + key + '" layer cap exceeded (' + L.length + ')');
  snd[key] = { layers: L };
}
if (Object.keys(snd).length + 2 > 32) die('sound count cap');
snd.skank = { layers: [
  { type: 'tone', wave: 'square', freq: 440, sweep: -20, dur: 0.09, vol: 0.10 },
  { type: 'tone', wave: 'square', freq: 554, sweep: -20, dur: 0.09, vol: 0.08 },
  { type: 'tone', wave: 'square', freq: 659, sweep: -20, dur: 0.09, vol: 0.07 }
]};
snd.bassr = { layers: [
  { type: 'tone', wave: 'sine', freq: 110, sweep: -8, dur: 0.28, vol: 0.16 },
  { type: 'tone', wave: 'sine', freq: 55,  sweep: -4, dur: 0.28, vol: 0.10 }
]};

// ---------- 4. reggae loop branches (one-drop-ish over a 2s bar, 8th grid) ----------
const director = byId('director');
if (!director || !director.bt || !Array.isArray(director.bt.sequence)) die('director.bt missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
// rbeat = floor(mod(world.time, 2) * 4)  -> 0..7
const beatSeq = [{ sequence: [
  { cond: '1 == 1' },
  { do: { action: 'setFlagExpr', args: ['rbeat', 'floor(mod(world.time, 2) * 4)'] } }
]}];
const pattern = { 1: ['skank'], 3: ['skank', 'bassr'], 5: ['skank'], 6: ['bassr'], 7: ['skank'] };
const beatBranches = [];
for (let b = 0; b < 8; b++) {
  const acts = [{ do: { action: 'setState', args: ['shown_rbeat', b] } }];
  for (const s of (pattern[b] || [])) acts.push({ do: { action: 'playSound', args: [s] } });
  beatBranches.push({ sequence: [
    { cond: 'world.flags.rbeat == ' + b + ' && world.flags.shown_rbeat != ' + b }
  ].concat(acts) });
}
// music branches must not block gameplay branches: selector stops at first success,
// so wrap beat logic in its own parallel-safe spot -> prepend expr update as non-terminal? Engine selector
// semantics: first success wins per tick. Beat branch succeeds at most once per 8th note; expr-set branch
// always succeeds and would starve everything. Fix: fold rbeat expr INTO each beat branch instead.
beatSeq.length = 0;
for (const br of beatBranches) {
  br.sequence.splice(1, 0, { do: { action: 'setFlagExpr', args: ['rbeat', 'floor(mod(world.time, 2) * 4)'] } });
  br.sequence[0] = { cond: 'floor(mod(world.time, 2) * 4) == ' + br.sequence[0].cond.match(/rbeat == (\d)/)[1] + ' && world.flags.shown_rbeat != ' + br.sequence[0].cond.match(/!= (\d)/)[1] };
}
rootSel.unshift(...beatBranches);

// boot init shown_rbeat before ready
let bootOk = false;
(function walk(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) { o.splice(ri, 0, { after: 0.1, do: { action: 'setState', args: ['shown_rbeat', -1] } }); bootOk = true; return; }
    o.forEach(walk);
  } else Object.values(o).forEach(walk);
})(director.alarms);
if (!bootOk) die('boot ready anchor not found');

// ---------- write ----------
const v13str = JSON.stringify(j);
fs.writeFileSync('kascity_v13.json', v13str);

const anchor = 'if (n.type === "ProgressBar" && n.bind) {';
const occA = engine.split(anchor).length - 1;
if (occA !== 1) die('engine bind anchor occurrences = ' + occA);
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(anchor).join(labelBind + anchor);
const inject = [
  '', '// ---- injected kascity v13 showcase ----',
  'try { loadScene(' + JSON.stringify(v13str) + '); }',
  "catch (e) { console.error('kascity13 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity13.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS portraits corners+colors 4/4 (scale 0.32)');
console.log('PASS hud cash corners 4/4 (bottom anchors ' + (hasBL && hasBR ? 'native' : 'fallback-top') + ')');
console.log('PASS ka-ching layered onto buy/rent/depot');
console.log('PASS reggae kit skank+bassr, ' + beatBranches.length + ' beat branches, boot init');
console.log('OK kascity_v13.json (' + (v13str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity13.html');
