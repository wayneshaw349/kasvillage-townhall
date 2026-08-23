// kascity_visual_v30.cjs
// Reads kascity_v29.json + scene_engine.html -> writes kascity_v30.json + showcase_kascity30.html
// 1) Center art switches with the title: all event panels hidden at boot so the middle shows art
//    only while its event caption is up (the cel system already swaps them; one was stuck visible).
// 2) Visible dice roll: every roll pops a big pixel number (2-12) in the middle for 1.4s.
// 3) Property boxes: dark shadow plates removed; every district gets its own BRIGHT earth-town color
//    (flat, no texture). Everything else untouched.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v29.json')) die('kascity_v29.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v29.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. remove shadow plates ----------
let remS = 0;
for (const n of j.nodes) {
  if (!n.children) continue;
  const before = n.children.length;
  n.children = n.children.filter(c => !/^bshad_/.test(c.id || ''));
  remS += before - n.children.length;
}
if (remS < 16) die('shadow plates removed ' + remS);

// ---------- 2. bright earth-town district colors (flat) ----------
const distCol = {
  g_kiln: '#e2725b', g_copper: '#e8a87c', g_market: '#f2b880', g_orchard: '#e8c468',
  g_amber: '#d9a05b', g_beacon: '#f0d080', g_cathedral: '#c9d18a', g_crown: '#e8b04c'
};
for (const [g, col] of Object.entries(distCol)) RES.materials['td_' + g.slice(2)] = { color: col };
let tinted = 0;
for (let i = 0; i < 40; i++) {
  const tile = byId('tile_' + i);
  if (!tile || !tile.children) continue;
  const band = tile.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !distCol[band.material]) continue;
  tile.material = 'td_' + band.material.slice(2);
  tinted++;
}
if (tinted < 16) die('tiles tinted ' + tinted);

// ---------- 3. boot-hide all event panels ----------
const panelIds = j.nodes.filter(n => /^panel_/.test(n.id || '')).map(n => n.id);
if (panelIds.length < 8) die('panels found ' + panelIds.length);

// ---------- 4. dice numerals ----------
const FONT = { // 3x5 digit font
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'], '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'], '7': ['111','001','010','010','010'],
  '8': ['111','101','111','101','111'], '9': ['111','101','111','001','111']
};
function numSprite(str) {
  const scale = 2, dw = 3 * scale, gap = scale, W = str.length * dw + (str.length - 1) * gap + 4, H = 5 * scale + 4;
  const r = [{ rect: [0, 0, W, H], color: '#241c12' }];
  let x = 2;
  for (const ch of str) {
    const rows = FONT[ch];
    for (let y = 0; y < 5; y++) for (let c = 0; c < 3; c++) if (rows[y][c] === '1')
      r.push({ rect: [x + c * scale, 2 + y * scale, scale, scale], color: '#f8f0d8' });
    x += dw + gap;
  }
  return { w: W, h: H, frames: [r] };
}
for (let v = 2; v <= 12; v++) RES.sprites['num_' + v] = numSprite(String(v));
for (let v = 2; v <= 12; v++) {
  j.nodes.push({ id: 'die_' + v, type: 'Billboard', sprite: 'num_' + v, spriteSize: 3.2, aspect: v < 10 ? 0.9 : 1.5,
    visible: false, transform: { pos: [0, 3.4, 0] }, tags: ['dice'] });
}

// roll branches: after each fate draw, record roll value + trigger display
let rollN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    const hasDraw = seq.some(e => e && e.do && e.do.action === 'drawCard' && e.do.args && e.do.args[0] === 'fate');
    const hasSum = seq.some(e => e && e.do && e.do.action === 'setFlagExpr' && e.do.args && e.do.args[0] === 'sum');
    if (hasDraw && hasSum && !seq.some(e => e && e.do && e.do.args && e.do.args[0] === 'rollv')) {
      seq.push(
        { do: { action: 'setFlagExpr', args: ['rollv', "lastCard('fate') + 2"] } },
        { do: { action: 'setState', args: ['rollshow', 1] } },
        { do: { action: 'setFlagExpr', args: ['rollt', 'world.time'] } }
      );
      rollN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (rollN < 3) die('roll branches wired ' + rollN);

const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
const diceBr = [];
for (let v = 2; v <= 12; v++) {
  diceBr.push({ sequence: [
    { cond: 'world.flags.rollshow == 1 && world.flags.rollv == ' + v },
    { do: { action: 'show', args: [], to: 'die_' + v } },
    { do: { action: 'setState', args: ['rollshow', 2] } }
  ]});
  diceBr.push({ sequence: [
    { cond: 'world.flags.rollshow == 2 && world.flags.rollv == ' + v + ' && world.time - world.flags.rollt > 1.4' },
    { do: { action: 'hide', args: [], to: 'die_' + v } },
    { do: { action: 'setState', args: ['rollshow', 0] } }
  ]});
}
rootSel.unshift(...diceBr);

// boot: hide panels + dice flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = panelIds.map(id => ({ after: 0.1, do: { action: 'hide', args: [], to: id } }));
      ins.push({ after: 0.1, do: { action: 'setState', args: ['rollshow', 0] } });
      ins.push({ after: 0.1, do: { action: 'setState', args: ['rollv', -1] } });
      ins.push({ after: 0.1, do: { action: 'setState', args: ['rollt', 0] } });
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > ((j.compliance && j.compliance.maxNodes) || 512)) die('node cap: ' + total);

// ---------- write ----------
const v30str = JSON.stringify(j);
fs.writeFileSync('kascity_v30.json', v30str);

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
engine = engine.split(bindAnchor).join(
  'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) { n.text = "" + Math.round(cvb); (window.KV_STATS || (window.KV_STATS = {}))[n.bind] = Math.round(cvb); } }\n    ' + bindAnchor);

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v30 showcase');

fs.writeFileSync('showcase_kascity30.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v30str) + '); }',
  "catch (e) { console.error('kascity30 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS ' + remS + ' shadow plates removed; ' + tinted + ' tiles in bright earth-town colors');
console.log('PASS ' + panelIds.length + ' center panels boot-hidden (art now switches with title)');
console.log('PASS dice roll display 2-12 wired on ' + rollN + ' roll branches');
console.log('PASS nodes ' + total + '/512');
console.log('OK kascity_v30.json + showcase_kascity30.html');
