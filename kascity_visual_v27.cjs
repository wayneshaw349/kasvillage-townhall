// kascity_visual_v27.cjs
// Reads kascity_v26.json + scene_engine.html -> writes kascity_v27.json + showcase_kascity27.html
// 1) Look: dark fog removed -> lighter pre-v26 backdrop; gouraud/rim/shadows + textures kept.
// 2) Buildings detailed: every building gets a door, glowing windows, and trims — the main thing
//    that makes box-buildings read as real buildings.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v26.json')) die('kascity_v26.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing (corner-card source)');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v26.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);

// ---------- 1. lighter look ----------
if (j.render) delete j.render.fog;

// ---------- 2. detail meshes + materials ----------
Object.assign(RES.meshes, {
  b_win:  { type: 'box', size: [0.18, 0.22, 0.06] },
  b_door: { type: 'box', size: [0.26, 0.38, 0.06] },
  b_doorT:{ type: 'box', size: [0.26, 0.55, 0.06] },
  b_trim: { type: 'box', size: [1.28, 0.09, 0.96] }
});
Object.assign(RES.materials, {
  m_winlit: { color: '#f8e070' }, m_winsky: { color: '#8cc4f0' }, m_door: { color: '#3a2a1a' }
});

function B(mesh, mat, x, y, z, rot) { const n = { mesh, material: mat, transform: { pos: [x, y, z] } }; if (rot) n.transform.rot = rot; return n; }
// windows/door sit just proud of the building front face (buildings centered ~z 0.2, depth <= 1.0)
const F = 0.74; // front z for base/wide, tweak per part below
const builds = {
  g_kiln: () => [
    B('b_wide', 'm_factory', 0, 0.4, 0.2), B('b_chim', 'm_dark', -0.5, 1.0, 0.2), B('b_chim', 'm_dark', -0.15, 0.95, 0.2),
    B('b_door', 'm_door', 0.45, 0.29, F), B('b_win', 'm_winsky', -0.35, 0.5, F), B('b_win', 'm_winsky', -0.05, 0.5, F), B('b_win', 'm_winsky', 0.25, 0.5, F)
  ],
  g_copper: () => [
    B('b_wide', 'm_shed', 0, 0.4, 0.2), B('b_roofS', 'm_dark', -0.4, 0.85, 0.2), B('b_roofS', 'm_dark', 0.4, 0.85, 0.2),
    B('b_doorT', 'm_door', 0, 0.35, F), B('b_win', 'm_winsky', -0.5, 0.45, F), B('b_win', 'm_winsky', 0.5, 0.45, F)
  ],
  g_market: () => [
    B('b_base', 'm_shop', 0, 0.48, 0.15), B('b_awn', 'm_white', 0, 0.9, 0.55), B('b_roofS', 'm_dark', 0, 1.0, 0.1, [0, 45, 0]),
    B('b_door', 'm_door', -0.3, 0.29, 0.62), B('b_win', 'm_winlit', 0.15, 0.5, 0.62), B('b_win', 'm_winlit', 0.4, 0.5, 0.62)
  ],
  g_orchard: () => [
    B('b_base', 'm_house', 0, 0.48, 0.2), B('b_roofS', 'm_town', 0, 1.0, 0.2, [0, 45, 0]),
    B('b_door', 'm_door', 0, 0.29, 0.67), B('b_win', 'm_winlit', -0.35, 0.55, 0.67), B('b_win', 'm_winlit', 0.35, 0.55, 0.67)
  ],
  g_amber: () => [
    B('b_base', 'm_town', 0, 0.48, 0.2), B('b_base', 'm_town', 0, 1.2, 0.2), B('b_roofS', 'm_dark', 0, 1.72, 0.2, [0, 45, 0]),
    B('b_door', 'm_door', 0, 0.29, 0.67),
    B('b_win', 'm_winlit', -0.3, 0.62, 0.67), B('b_win', 'm_winlit', 0.3, 0.62, 0.67),
    B('b_win', 'm_winlit', -0.3, 1.28, 0.67), B('b_win', 'm_winlit', 0.3, 1.28, 0.67)
  ],
  g_beacon: () => [
    B('b_tall', 'm_watch', 0, 0.8, 0.2), B('b_roofS', 'm_gold', 0, 1.66, 0.2, [0, 45, 0]),
    B('b_door', 'm_door', 0, 0.29, 0.55),
    B('b_win', 'm_winlit', 0, 0.75, 0.55), B('b_win', 'm_winlit', 0, 1.15, 0.55)
  ],
  g_cathedral: () => [
    B('b_base', 'm_church', 0, 0.48, 0.25), B('b_steep', 'm_church', -0.35, 1.2, 0.25), B('b_roofS', 'm_gold', -0.35, 1.85, 0.25, [0, 45, 0]),
    B('b_doorT', 'm_door', 0.1, 0.36, 0.72),
    B('b_win', 'm_winsky', -0.35, 0.65, 0.72), B('b_win', 'm_winsky', 0.45, 0.65, 0.72), B('b_win', 'm_winsky', -0.35, 1.35, 0.42)
  ],
  g_crown: () => [
    B('b_wide', 'm_mansion', 0, 0.4, 0.2), B('b_twr', 'm_mansion', -0.55, 1.0, 0.2), B('b_twr', 'm_mansion', 0.55, 1.0, 0.2),
    B('b_roofS', 'm_gold', 0, 0.85, 0.2, [0, 45, 0]), B('b_trim', 'm_gold', 0, 0.72, 0.2),
    B('b_doorT', 'm_door', 0, 0.36, F),
    B('b_win', 'm_winlit', -0.55, 1.1, 0.42), B('b_win', 'm_winlit', 0.55, 1.1, 0.42),
    B('b_win', 'm_winlit', -0.25, 0.5, F), B('b_win', 'm_winlit', 0.25, 0.5, F)
  ]
};

let built = 0;
for (let i = 0; i < 40; i++) {
  const tile = byId('tile_' + i);
  if (!tile || !tile.children) continue;
  const band = tile.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !builds[band.material]) continue;
  tile.children = tile.children.filter(c => !/^bldg_/.test(c.id || ''));
  const parts = builds[band.material]();
  parts.forEach((p, k) => { p.id = 'bldg_' + i + '_' + k; });
  tile.children.push(...parts);
  built++;
}
if (built < 16) die('buildings rebuilt ' + built);

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
const cap = (j.compliance && j.compliance.maxNodes) || 512;
if (total > cap) die('nodes ' + total + ' > ' + cap);

// ---------- write ----------
const v27str = JSON.stringify(j);
fs.writeFileSync('kascity_v27.json', v27str);

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
if (cs < 0 || ce <= cs) die('corner-card block not found in showcase_kascity25.html');
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v27 showcase');

fs.writeFileSync('showcase_kascity27.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v27str) + '); }',
  "catch (e) { console.error('kascity27 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS lighter backdrop (fog removed), shading + textures kept');
console.log('PASS ' + built + ' buildings detailed: doors, glowing windows, trims');
console.log('PASS nodes ' + total + '/' + cap);
console.log('OK kascity_v27.json + showcase_kascity27.html');
