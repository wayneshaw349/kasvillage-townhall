// kascity_visual_v29.cjs
// Reads kascity_v28.json + scene_engine.html -> writes kascity_v29.json + showcase_kascity29.html
// 1) Ownership shown as a colored BORDER around the square: the owner plate becomes a wider, slightly
//    lower mat so only its rim shows around the tile edges in the avatar's color.
// 2) Board lights up on purchase: every buy/trade that flips ownership also flashes a bright glow
//    frame on that square for ~1.2s (auto-dismissed).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v28.json')) die('kascity_v28.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v28.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. border mats ----------
RES.meshes.ownPlate = { type: 'box', size: [2.5, 0.08, 2.5] };
RES.meshes.glowMat = { type: 'box', size: [2.7, 0.05, 2.7] };
RES.materials.m_glow = { color: '#fff2a0' };
let borderN = 0, glowAdd = 0;
const glowTiles = [];
for (const n of j.nodes) {
  if (!n.children) continue;
  const m0 = /^tile_(\d+)$/.exec(n.id || '');
  for (const c of n.children) {
    const m = /^own_(\d+)_(\d)$/.exec(c.id || '');
    if (!m) continue;
    c.transform.pos = [0, 0.075 + parseInt(m[2], 10) * 0.003, 0];
    borderN++;
  }
  if (m0 && n.children.some(c => /^own_/.test(c.id || ''))) {
    const i = m0[1];
    if (!n.children.some(c => c.id === 'glow_' + i)) {
      n.children.push({ id: 'glow_' + i, mesh: 'glowMat', material: 'm_glow', hidden: true, transform: { pos: [0, 0.055, 0] } });
      glowAdd++;
    }
    glowTiles.push(i);
  }
}
if (borderN < 80) die('border plates ' + borderN);
if (glowAdd < 16) die('glow nodes ' + glowAdd);

// ---------- 2. glow show on every ownership flip ----------
let glowShowN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    let tile = null;
    for (const e of seq) {
      if (e && e.do && e.do.action === 'show' && typeof e.do.to === 'string') {
        const m = /^own_(\d+)_\d$/.exec(e.do.to);
        if (m) { tile = m[1]; break; }
      }
    }
    if (tile !== null && !seq.some(e => e && e.do && e.do.to === 'glow_' + tile)) {
      seq.push(
        { do: { action: 'show', args: [], to: 'glow_' + tile } },
        { do: { action: 'setState', args: ['glown', parseInt(tile, 10)] } },
        { do: { action: 'setFlagExpr', args: ['glowt', 'world.time'] } }
      );
      glowShowN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (glowShowN < 20) die('glow shows ' + glowShowN);

// dismiss branches (front of root selector)
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
const uniq = [...new Set(glowTiles)];
const dism = uniq.map(i => ({ sequence: [
  { cond: 'world.flags.glown == ' + i + ' && world.time - world.flags.glowt > 1.2' },
  { do: { action: 'hide', args: [], to: 'glow_' + i } },
  { do: { action: 'setState', args: ['glown', -1] } }
]}));
rootSel.unshift(...dism);

// boot
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['glown', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['glowt', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > ((j.compliance && j.compliance.maxNodes) || 512)) die('node cap exceeded: ' + total);

// ---------- write ----------
const v29str = JSON.stringify(j);
fs.writeFileSync('kascity_v29.json', v29str);

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
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v29 showcase');

fs.writeFileSync('showcase_kascity29.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v29str) + '); }',
  "catch (e) { console.error('kascity29 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS owner BORDERS (' + borderN + ' plates -> rim mats)');
console.log('PASS glow flash wired on ' + glowShowN + ' ownership flips, ' + uniq.length + ' dismissers');
console.log('PASS nodes ' + total + '/512');
console.log('OK kascity_v29.json + showcase_kascity29.html');
