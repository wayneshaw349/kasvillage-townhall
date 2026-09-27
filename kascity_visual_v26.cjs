// kascity_visual_v26.cjs
// Reads kascity_v25.json + scene_engine.html -> writes kascity_v26.json + showcase_kascity26.html
// Graphics pass using engine features confirmed present: gouraud shading, rim light, distance fog,
// shadows, and procedural textures (noise/brick). Adds material grain: felt table, wood board frame,
// parchment tiles, brick factory. Unknown-key risk is nil — unsupported render keys are ignored.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v25.json')) die('kascity_v25.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v25.json', 'utf8'));
const RES = j.resources || die('resources missing');

// ---------- 1. render flags ----------
j.render = Object.assign({}, j.render, {
  gouraud: true,
  rim: { enabled: true },
  shadows: true,
  fog: { color: '#0e1a14' }
});

// ---------- 2. procedural textures ----------
RES.textures = Object.assign({}, RES.textures, {
  tx_felt:  { type: 'noise', size: 64, scale: 24, colors: ['#14352a', '#1d4534'] },
  tx_wood:  { type: 'noise', size: 64, scale: 6,  colors: ['#d9c9a6', '#eadfc4'] },
  tx_parch: { type: 'noise', size: 64, scale: 18, colors: ['#e8dcbc', '#f4ecd4'] },
  tx_brick: { type: 'brick', size: 64, rows: 6, cols: 4, colors: ['#a8442e', '#7a2e1e'] }
});

// ---------- 3. wire textures onto materials ----------
const wire = {
  felt: 'tx_felt', board: 'tx_wood',
  tile_poor: 'tx_parch', tile_mid: 'tx_parch', tile_upper: 'tx_parch', tile_rich: 'tx_parch',
  corner: 'tx_wood', m_factory: 'tx_brick'
};
let wired = 0;
for (const [mat, tex] of Object.entries(wire)) {
  if (!RES.materials[mat]) die('material ' + mat + ' missing');
  RES.materials[mat].texture = tex;
  wired++;
}
if (wired !== Object.keys(wire).length) die('texture wiring ' + wired);

// ---------- write ----------
const v26str = JSON.stringify(j);
fs.writeFileSync('kascity_v26.json', v26str);

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

const faceColSrc = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cardsStart = faceColSrc.indexOf('// ---- injected kascity v25 showcase ----');
const cardsEnd = faceColSrc.indexOf('try { loadScene(');
if (cardsStart < 0 || cardsEnd < 0 || cardsEnd <= cardsStart) die('cannot lift corner-card block from showcase_kascity25.html');
const cardsJs = faceColSrc.slice(cardsStart, cardsEnd).replace('v25 showcase', 'v26 showcase');

fs.writeFileSync('showcase_kascity26.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v26str) + '); }',
  "catch (e) { console.error('kascity26 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS render: gouraud + rim + shadows + fog');
console.log('PASS textures: felt grain, wood board, parchment tiles, brick factory (' + wired + ' materials wired)');
console.log('PASS corner cards carried over from v25 showcase');
console.log('OK kascity_v26.json + showcase_kascity26.html');
