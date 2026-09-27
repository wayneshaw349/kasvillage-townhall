// kascity_visual_v28.cjs
// Reads kascity_v27.json + scene_engine.html -> writes kascity_v28.json + showcase_kascity28.html
// Makes the existing 3D read MORE 3D with three classic depth cues, zero engine changes:
//  1. ground shadow plate under each building (offset dark plate = strongest cheap depth cue)
//  2. roof overhang: roofs enlarged so eaves hang past walls
//  3. sun-side highlight strip on one vertical corner of each building
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v27.json')) die('kascity_v27.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing (corner-card source)');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v27.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);

// ---------- meshes/materials ----------
Object.assign(RES.meshes, {
  b_shadow: { type: 'box', size: [1.7, 0.015, 1.15] },
  b_hilite: { type: 'box', size: [0.06, 0.7, 0.06] },
  b_roofS:  { type: 'box', size: [1.05, 0.3, 1.05] }   // overhang: was 0.85
});
Object.assign(RES.materials, {
  m_shadow: { color: '#0c1f17' },
  m_hilite: { color: '#fff8e0' }
});

// ---------- add shadow plate + highlight strip per building group ----------
let touched = 0;
for (let i = 0; i < 40; i++) {
  const tile = byId('tile_' + i);
  if (!tile || !tile.children) continue;
  const hasB = tile.children.some(c => /^bldg_/.test(c.id || ''));
  if (!hasB) continue;
  tile.children = tile.children.filter(c => !/^(bshad_|bhi_)/.test(c.id || ''));
  tile.children.push(
    { id: 'bshad_' + i, mesh: 'b_shadow', material: 'm_shadow', transform: { pos: [0.22, 0.115, 0.42] } },
    { id: 'bhi_' + i, mesh: 'b_hilite', material: 'm_hilite', transform: { pos: [-0.62, 0.47, 0.68] } }
  );
  touched++;
}
if (touched < 16) die('buildings touched ' + touched);

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
const cap = (j.compliance && j.compliance.maxNodes) || 512;
if (total > cap) die('nodes ' + total + ' > ' + cap);

// ---------- write ----------
const v28str = JSON.stringify(j);
fs.writeFileSync('kascity_v28.json', v28str);

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
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v28 showcase');

fs.writeFileSync('showcase_kascity28.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v28str) + '); }',
  "catch (e) { console.error('kascity28 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS shadow plates + highlight strips on ' + touched + ' buildings, roofs overhang');
console.log('PASS nodes ' + total + '/' + cap);
console.log('OK kascity_v28.json + showcase_kascity28.html');
