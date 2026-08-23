// kascity_visual_v32.cjs
// Reads kascity_v31.json + scene_engine.html -> writes kascity_v32.json + showcase_kascity32.html
// Brightness pass: gouraud + shadow darkening OFF (they were muddying tile faces), district squares
// remapped to a bright mustard-family palette, table felt and frame lifted a notch. Rim light kept.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v31.json')) die('kascity_v31.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v31.json', 'utf8'));
const RES = j.resources || die('resources missing');

// ---------- 1. kill the darkeners, keep rim ----------
if (j.render) { delete j.render.gouraud; delete j.render.shadows; delete j.render.fog; }

// ---------- 2. bright mustard-family district colors ----------
const bright = {
  td_kiln: '#e0b83e',      // mustard
  td_copper: '#ecd48c',    // pale sand
  td_market: '#f4c078',    // apricot
  td_orchard: '#e8c25a',   // bright ochre
  td_amber: '#ee9670',     // light terracotta
  td_beacon: '#f6da70',    // golden
  td_cathedral: '#cdd188', // light sage
  td_crown: '#f0b84c'      // amber gold
};
let recol = 0;
for (const [m, c] of Object.entries(bright)) {
  if (!RES.materials[m]) die('material ' + m + ' missing');
  RES.materials[m] = { color: c }; // flat, no texture
  recol++;
}
if (recol !== 8) die('recolored ' + recol);

// ---------- 3. lift the table ----------
if (!RES.materials.felt) die('felt missing');
RES.materials.felt = { color: '#1d5a40', texture: 'tx_felt' };
RES.textures.tx_felt = { type: 'noise', size: 64, scale: 24, colors: ['#1d5a40', '#2a7050'] };
if (RES.materials.board) RES.materials.board.color = '#f0e6c8';
if (RES.materials.inlay) RES.materials.inlay.color = '#1a4a36';

// ---------- write ----------
const v32str = JSON.stringify(j);
fs.writeFileSync('kascity_v32.json', v32str);

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
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v32 showcase');

fs.writeFileSync('showcase_kascity32.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v32str) + '); }',
  "catch (e) { console.error('kascity32 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS gouraud/shadow darkening off, rim kept');
console.log('PASS 8 districts in bright mustard-family palette');
console.log('PASS table felt + frame lifted');
console.log('OK kascity_v32.json + showcase_kascity32.html');
