// kascity_visual_v18.cjs
// Reads kascity_v17.json + scene_engine.html -> writes kascity_v18.json + showcase_kascity18.html
// Replaces the unreliable billboard icons with solid 3D mini-buildings inside each property square
// (same rendering path as the original tiny house, which displays correctly). One building style +
// color per district: factory(chimney) shedrow shop(awning) house townhouse watchtower church(steeple)
// mansion(twin towers). Removes all tileart_* billboards. Owner plates, portraits, sounds untouched.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V17 = 'kascity_v17.json';
if (!fs.existsSync(V17)) die(V17 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V17, 'utf8'));
const RES = j.resources || die('resources missing');
const nodes = j.nodes;

// ---------- 1. building meshes + materials ----------
Object.assign(RES.meshes, {
  b_base:    { type: 'box', size: [0.95, 0.55, 0.75] },
  b_wide:    { type: 'box', size: [1.35, 0.45, 0.85] },
  b_tall:    { type: 'box', size: [0.55, 1.05, 0.55] },
  b_chim:    { type: 'box', size: [0.18, 0.55, 0.18] },
  b_steep:   { type: 'box', size: [0.22, 0.75, 0.22] },
  b_awn:     { type: 'box', size: [1.0, 0.08, 0.35] },
  b_twr:     { type: 'box', size: [0.3, 0.8, 0.3] },
  b_roofS:   { type: 'box', size: [0.6, 0.22, 0.6] }
});
Object.assign(RES.materials, {
  m_factory: { color: '#8a5a3a' }, m_shed: { color: '#7a8a9a' }, m_shop: { color: '#c9569a' },
  m_house: { color: '#d98232' }, m_town: { color: '#c0392b' }, m_watch: { color: '#d8c33a' },
  m_church: { color: '#f0ead8' }, m_mansion: { color: '#2f3f8e' },
  m_gold: { color: '#caa64c' }, m_dark: { color: '#3a3a44' }, m_white: { color: '#fdf6e3' }
});

// per-district building composition (children specs; pos relative to tile center)
function B(mesh, mat, x, y, z, rot) { const n = { mesh: mesh, material: mat, transform: { pos: [x, y, z] } }; if (rot) n.transform.rot = rot; return n; }
const builds = {
  g_kiln:      () => [B('b_wide', 'm_factory', 0, 0.28, 0.2), B('b_chim', 'm_dark', -0.45, 0.75, 0.2), B('b_chim', 'm_dark', -0.15, 0.7, 0.2)],
  g_copper:    () => [B('b_wide', 'm_shed', 0, 0.24, 0.2), B('b_roofS', 'm_dark', -0.35, 0.5, 0.2), B('b_roofS', 'm_dark', 0.35, 0.5, 0.2)],
  g_market:    () => [B('b_base', 'm_shop', 0, 0.29, 0.2), B('b_awn', 'm_white', 0, 0.6, 0.55), B('b_roofS', 'm_dark', 0, 0.62, 0.1, [0, 45, 0])],
  g_orchard:   () => [B('b_base', 'm_house', 0, 0.29, 0.2), B('b_roofS', 'm_town', 0, 0.66, 0.2, [0, 45, 0])],
  g_amber:     () => [B('b_base', 'm_town', 0, 0.29, 0.2), B('b_base', 'm_town', 0, 0.75, 0.2), B('b_roofS', 'm_dark', 0, 1.1, 0.2, [0, 45, 0])],
  g_beacon:    () => [B('b_tall', 'm_watch', 0, 0.54, 0.2), B('b_roofS', 'm_gold', 0, 1.15, 0.2, [0, 45, 0])],
  g_cathedral: () => [B('b_base', 'm_church', 0, 0.29, 0.25), B('b_steep', 'm_church', -0.3, 0.85, 0.25), B('b_roofS', 'm_gold', -0.3, 1.28, 0.25, [0, 45, 0])],
  g_crown:     () => [B('b_wide', 'm_mansion', 0, 0.24, 0.2), B('b_twr', 'm_mansion', -0.5, 0.75, 0.2), B('b_twr', 'm_mansion', 0.5, 0.75, 0.2), B('b_roofS', 'm_gold', 0, 0.55, 0.2, [0, 45, 0])]
};

// ---------- 2. swap tile buildings ----------
let built = 0;
for (let i = 0; i < 40; i++) {
  const tile = nodes.find(n => n.id === 'tile_' + i);
  if (!tile || !tile.children) continue;
  const band = tile.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !builds[band.material]) continue;
  // drop old bld/roof children, keep band + own plates
  tile.children = tile.children.filter(c => !/^(bld_|roof_)/.test(c.id || ''));
  const parts = builds[band.material]();
  parts.forEach((p, k) => { p.id = 'bldg_' + i + '_' + k; });
  tile.children.push(...parts);
  built++;
}
if (built < 16) die('buildings placed ' + built + ' (<16)');

// ---------- 3. remove billboard tile icons ----------
let removed = 0;
for (let k = nodes.length - 1; k >= 0; k--) {
  if (/^tileart_\d+$/.test(nodes[k].id || '')) { nodes.splice(k, 1); removed++; }
}
if (removed < 16) die('tileart removed ' + removed + ' (<16)');

// node cap
function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(nodes);
const cap = (j.compliance && j.compliance.maxNodes) || 512;
if (total > cap) die('node count ' + total + ' > ' + cap);

// ---------- write ----------
const v18str = JSON.stringify(j);
fs.writeFileSync('kascity_v18.json', v18str);

const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
const speechCode = fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try {\n' +
  '      var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel();\n' +
  '      window.speechSynthesis.speak(_u);\n' +
  '    } catch (e) {}\n' +
  '  }\n';
engine = engine.split(fnAnchor).join(speechCode);
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(bindAnchor).join(labelBind + bindAnchor);

const inject = [
  '', '// ---- injected kascity v18 showcase ----',
  'try { loadScene(' + JSON.stringify(v18str) + '); }',
  "catch (e) { console.error('kascity18 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity18.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS mini-buildings on ' + built + ' squares (factory/shed/shop/house/townhouse/watchtower/church/mansion)');
console.log('PASS ' + removed + ' billboard icons removed');
console.log('PASS nodes ' + total + '/' + cap);
console.log('OK kascity_v18.json (' + (v18str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity18.html');
